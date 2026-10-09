import { searchIndex } from "@/lib/inventory/keys";
import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import { selectFEFOInventory, validateShelfLife } from "@/lib/logistics/scoring";
import { allocateInventory } from "@/lib/logistics/server";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";
import { queryMasterDocuments, readMasterDocument, type AtomicWrite } from "@/lib/masters/firestore";
import {
  applyApprovalAction,
  createApprovalWrites,
  filterOrderApprovalSteps,
  loadApprovals,
  loadWorkflowConfig,
  type SalesWorkflowModule,
} from "@/lib/sales/approvals";
import { SALES_COLLECTIONS } from "@/lib/sales/collections";
import {
  DEFAULT_DISCOUNT_APPROVAL_THRESHOLD_PERCENT,
  DEFAULT_FINANCE_REVIEW_ORDER_VALUE,
  WORKFLOW_MODULES,
} from "@/lib/sales/config";
import { validateCustomerCredit } from "@/lib/sales/credit";
import {
  calculateOrderFulfilment,
  canCloseOrder,
  deriveOrderBlockers,
  loadOrderLogisticsLinks,
} from "@/lib/sales/fulfilment";
import {
  actorStamp,
  auditSales,
  commitWrites,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueSalesNumber,
  listByField,
  notifySales,
  parseOrFail,
  requireRecord,
  reuseIdempotent,
  statusHistoryWrite,
  text,
  workflowFail,
  writeOf,
} from "@/lib/sales/helpers";
import { calculateDocumentTotals, calculateLineTotal, discountPercent, money } from "@/lib/sales/money";
import { requiresDiscountApproval } from "@/lib/sales/pricing";
import { extractMinShelfLifeMonths, validateCustomerRequirements } from "@/lib/sales/requirements";
import {
  CMO_TRANSITIONS,
  ORDER_TRANSITIONS,
  PRICE_LIST_TRANSITIONS,
  QUOTATION_TRANSITIONS,
  REQUIREMENT_TRANSITIONS,
  RETURN_TRANSITIONS,
  canTransition,
  isLockedOrderStatus,
} from "@/lib/sales/status";
import {
  contractManufacturingOrderSchema,
  salesCommunicationSchema,
  salesCreditReviewSchema,
  salesDocumentSchema,
  salesOrderSchema,
  salesPriceListSchema,
  salesQuotationSchema,
  salesReceivableSnapshotSchema,
  salesRequirementSchema,
  salesReturnSchema,
  salesSettingsSchema,
  orderChangeSchema,
} from "@/lib/validation/sales";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";

function assertTransition(map: Record<string, string[]>, current: string, next: string, action: string) {
  if (!canTransition(map, current, next)) workflowFail(current, action);
}

async function loadSettings(idToken: string) {
  const rows = await queryMasterDocuments(SALES_COLLECTIONS.settings, idToken, { limit: 1 });
  const row = rows[0];
  return {
    discountApprovalThresholdPercent: money(
      row?.discountApprovalThresholdPercent ?? DEFAULT_DISCOUNT_APPROVAL_THRESHOLD_PERCENT
    ),
    financeReviewOrderValue: money(row?.financeReviewOrderValue ?? DEFAULT_FINANCE_REVIEW_ORDER_VALUE),
    creditUtilizationThresholdPercent: money(row?.creditUtilizationThresholdPercent ?? 90),
    requireQaReviewForExport: row?.requireQaReviewForExport !== false,
    requireRegulatoryReviewForExport: row?.requireRegulatoryReviewForExport !== false,
    defaultCurrency: text(row?.defaultCurrency) || "INR",
    defaultPaymentTerms: text(row?.defaultPaymentTerms),
  };
}

async function startApprovals(options: {
  module: SalesWorkflowModule;
  documentType: string;
  documentId: string;
  documentNumber: string;
  requestedBy: string;
  session: SessionPayload;
  idToken: string;
  steps?: ReturnType<typeof filterOrderApprovalSteps>;
}) {
  const workflow = await loadWorkflowConfig(options.module, options.idToken);
  const steps = options.steps || workflow.steps;
  return {
    workflow,
    writes: createApprovalWrites({
      documentType: options.documentType,
      documentId: options.documentId,
      documentNumber: options.documentNumber,
      requestedBy: options.requestedBy,
      steps,
      session: options.session,
    }),
  };
}

async function handleApproval(options: {
  documentType: string;
  documentId: string;
  action: "approve" | "reject" | "return";
  comment?: string;
  session: SessionPayload;
  idToken: string;
  module: SalesWorkflowModule;
}) {
  const approvals = await loadApprovals(options.documentId, options.idToken);
  const workflow = await loadWorkflowConfig(options.module, options.idToken);
  return applyApprovalAction({
    approvals,
    action: options.action,
    comment: options.comment,
    session: options.session,
    allowSelfApproval: workflow.allowSelfApproval,
  });
}

async function requireActiveCustomer(customerId: string, idToken: string) {
  const customer = await requireRecord("customers", customerId, idToken, "Customer");
  if (["blocked", "inactive", "suspended", "rejected"].includes(text(customer.status))) {
    fail(`Customer is ${text(customer.status)} and cannot be used for commercial documents.`);
  }
  return customer;
}

async function requireProduct(productId: string, idToken: string) {
  const product = await requireRecord("products", productId, idToken, "Product");
  if (["inactive", "obsolete", "blocked"].includes(text(product.status))) {
    fail(`Product ${text(product.productCode) || productId} is ${text(product.status)}.`);
  }
  return product;
}

function mapLineItems(
  items: Array<{
    productId: string;
    productCode?: string;
    productName?: string;
    packSize?: string;
    uom?: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    tax?: number;
    freight?: number;
    otherCharges?: number;
    moq?: number;
    notes?: string;
  }>,
  parent: { parentId: string; parentField: string },
  session: SessionPayload
) {
  return items.map((item, index) => {
    if (item.moq != null && item.quantity < item.moq) {
      fail(`Line ${index + 1} quantity is below the minimum order quantity (${item.moq}).`);
    }
    const itemId = crypto.randomUUID();
    const lineTotal = calculateLineTotal({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      tax: item.tax,
      freight: item.freight,
      otherCharges: item.otherCharges,
    });
    return {
      itemId,
      record: {
        [parent.parentField]: parent.parentId,
        lineId: itemId,
        lineNumber: index + 1,
        productId: item.productId,
        productCode: item.productCode || "",
        productName: item.productName || "",
        packSize: item.packSize || "",
        uom: item.uom || "",
        quantity: item.quantity,
        orderedQuantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        tax: item.tax || 0,
        freight: item.freight || 0,
        otherCharges: item.otherCharges || 0,
        lineTotal,
        reservedQuantity: 0,
        allocatedQuantity: 0,
        pickedQuantity: 0,
        dispatchedQuantity: 0,
        deliveredQuantity: 0,
        remainingQuantity: item.quantity,
        notes: item.notes || "",
        searchIndex: searchIndex(item.productId, item.productCode),
        ...actorStamp(session),
      },
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Price lists                                                                */
/* -------------------------------------------------------------------------- */

export async function createPriceList(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "salesPricing:create");
  const data = parseOrFail(salesPriceListSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  if (data.customerId) await requireActiveCustomer(data.customerId, options.idToken);
  const id = crypto.randomUUID();
  const numbered = await issueSalesNumber("PL", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const rules = data.rules.map((rule) => {
    const ruleId = crypto.randomUUID();
    const record = {
      ruleId,
      priceListId: id,
      ...rule,
      currency: rule.currency || data.currency,
      effectiveFrom: rule.effectiveFrom || data.effectiveFrom,
      effectiveTo: rule.effectiveTo || data.effectiveTo || "",
      status: "draft",
      ...actorStamp(options.session),
    };
    writes.push(writeOf(SALES_COLLECTIONS.priceRules, ruleId, record, { exists: false }));
    return record;
  });
  const record = {
    priceListId: id,
    priceListNumber: numbered.documentNumber,
    customerId: data.customerId || "",
    name: data.name,
    currency: data.currency,
    effectiveFrom: data.effectiveFrom,
    effectiveTo: data.effectiveTo || "",
    status: "draft",
    contractReference: data.contractReference || "",
    remarks: data.remarks || "",
    ruleCount: rules.length,
    searchIndex: searchIndex(numbered.documentNumber, data.name, data.customerId),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(SALES_COLLECTIONS.priceLists, id, record, { exists: false }));
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record, rules }, options.session));
  await commitWrites(writes, options.idToken);
  await auditSales(options.idToken, options.session, {
    action: "PRICE_LIST_CREATED",
    resource: SALES_COLLECTIONS.priceLists,
    resourceId: id,
    description: `Created price list ${numbered.documentNumber}.`,
  });
  return { id, record, rules };
}

export async function activatePriceList(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  ensurePermission(options.session, "salesPricing:approve");
  const current = await requireRecord(SALES_COLLECTIONS.priceLists, options.id, options.idToken, "Price list");
  assertTransition(PRICE_LIST_TRANSITIONS, text(current.status), "active", "activate");
  const next = {
    ...current,
    status: "active",
    activatedBy: options.session.uid,
    activatedAt: new Date().toISOString(),
    ...actorStamp(options.session, current),
  };
  const rules = await listByField(SALES_COLLECTIONS.priceRules, "priceListId", options.id, options.idToken);
  const writes: AtomicWrite[] = [
    writeOf(SALES_COLLECTIONS.priceLists, options.id, next),
    ...rules.map((rule) =>
      writeOf(SALES_COLLECTIONS.priceRules, String(rule.id), {
        ...rule,
        status: "active",
        ...actorStamp(options.session, rule),
      })
    ),
  ];
  await commitWrites(writes, options.idToken);
  await auditSales(options.idToken, options.session, {
    action: "PRICE_LIST_ACTIVATED",
    resource: SALES_COLLECTIONS.priceLists,
    resourceId: options.id,
    description: `Activated price list ${text(current.priceListNumber)}.`,
    reason: options.reason,
    oldData: { status: current.status },
    newData: { status: "active" },
  });
  return { id: options.id, record: next };
}

/* -------------------------------------------------------------------------- */
/* Quotations                                                                 */
/* -------------------------------------------------------------------------- */

export async function createQuotation(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
  id?: string;
}) {
  ensurePermission(options.session, options.id ? "salesQuotation:update" : "salesQuotation:create");
  const data = parseOrFail(salesQuotationSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireActiveCustomer(data.customerId, options.idToken);
  for (const item of data.items) await requireProduct(item.productId, options.idToken);
  if (data.validUntil < data.quotationDate) fail("Validity date cannot be earlier than quotation date.");
  const existing = options.id
    ? await requireRecord(SALES_COLLECTIONS.quotations, options.id, options.idToken, "Quotation")
    : null;
  if (existing && text(existing.status) !== "draft") fail("Only draft quotations can be edited.");
  const id = options.id || crypto.randomUUID();
  const numbered = existing
    ? { documentNumber: text(existing.quotationNumber) }
    : await issueSalesNumber("QT", options.session, options.idToken);
  const mapped = mapLineItems(data.items, { parentId: id, parentField: "quotationId" }, options.session);
  const totals = calculateDocumentTotals(
    mapped.map(({ record }) => ({
      quantity: record.quantity,
      unitPrice: record.unitPrice,
      discount: record.discount,
      tax: record.tax,
      freight: record.freight,
      otherCharges: record.otherCharges,
      lineTotal: record.lineTotal,
    }))
  );
  const version = Number(existing?.version || 0) + (existing ? 1 : 0) || 1;
  const writes: AtomicWrite[] = mapped.map(({ itemId, record }) =>
    writeOf(SALES_COLLECTIONS.quotationItems, itemId, record, { exists: false })
  );
  if (existing) {
    const oldItems = await listByField(SALES_COLLECTIONS.quotationItems, "quotationId", id, options.idToken);
    for (const old of oldItems) {
      writes.push(
        writeOf(SALES_COLLECTIONS.quotationItems, String(old.id), {
          ...old,
          status: "superseded",
          ...actorStamp(options.session, old),
        })
      );
    }
    writes.push(
      writeOf(
        SALES_COLLECTIONS.quotationVersions,
        crypto.randomUUID(),
        {
          quotationId: id,
          version: Number(existing.version || 1),
          snapshot: existing,
          ...actorStamp(options.session),
        },
        { exists: false }
      )
    );
  }
  const record = {
    quotationId: id,
    quotationNumber: numbered.documentNumber,
    customerId: data.customerId,
    quotationDate: data.quotationDate,
    validUntil: data.validUntil,
    currency: data.currency,
    paymentTerms: data.paymentTerms || "",
    deliveryTerms: data.deliveryTerms || "",
    expectedDeliveryDate: data.expectedDeliveryDate || "",
    salesRepresentative: data.salesRepresentative || options.session.uid,
    customerRequirements: data.customerRequirements || "",
    internalNotes: data.internalNotes || "",
    customerNotes: data.customerNotes || "",
    priceListId: data.priceListId || "",
    preparedBy: options.session.uid,
    status: "draft",
    approvalStatus: "not_started",
    version,
    sentExternally: false,
    ...totals,
    searchIndex: searchIndex(numbered.documentNumber, data.customerId),
    ...actorStamp(options.session, existing || undefined),
  };
  writes.push(writeOf(SALES_COLLECTIONS.quotations, id, record, { exists: existing ? undefined : false }));
  if (data.idempotencyKey) {
    writes.push(idempotencyWrite(data.idempotencyKey, { id, record, items: mapped.map((m) => m.record) }, options.session));
  }
  await commitWrites(writes, options.idToken);
  await auditSales(options.idToken, options.session, {
    action: existing ? "QUOTATION_UPDATED" : "QUOTATION_CREATED",
    resource: SALES_COLLECTIONS.quotations,
    resourceId: id,
    description: `${existing ? "Updated" : "Created"} quotation ${numbered.documentNumber}.`,
  });
  return { id, record, items: mapped.map((m) => m.record) };
}

export async function transitionQuotation(options: {
  id: string;
  action:
    | "submit_review"
    | "submit_approval"
    | "approve"
    | "reject"
    | "mark_sent"
    | "negotiate"
    | "accept"
    | "expire"
    | "cancel";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const current = await requireRecord(SALES_COLLECTIONS.quotations, options.id, options.idToken, "Quotation");
  const status = text(current.status);
  let nextStatus = status;
  let permission: Permission = "salesQuotation:update";
  const writes: AtomicWrite[] = [];

  if (options.action === "submit_review") {
    permission = "salesQuotation:submit";
    assertTransition(QUOTATION_TRANSITIONS, status, "internal_review", options.action);
    nextStatus = "internal_review";
  } else if (options.action === "submit_approval") {
    permission = "salesQuotation:submit";
    assertTransition(QUOTATION_TRANSITIONS, status, "pending_approval", options.action);
    nextStatus = "pending_approval";
    const { writes: approvalWrites } = await startApprovals({
      module: WORKFLOW_MODULES.salesQuotation,
      documentType: "salesQuotation",
      documentId: options.id,
      documentNumber: text(current.quotationNumber),
      requestedBy: options.session.uid,
      session: options.session,
      idToken: options.idToken,
    });
    writes.push(...approvalWrites);
  } else if (options.action === "approve" || options.action === "reject") {
    permission = "salesQuotation:approve";
    const result = await handleApproval({
      documentType: "salesQuotation",
      documentId: options.id,
      action: options.action,
      comment: options.comment,
      session: options.session,
      idToken: options.idToken,
      module: WORKFLOW_MODULES.salesQuotation,
    });
    writes.push(...result.writes);
    nextStatus = result.rejected ? "rejected" : result.completed ? "approved" : status;
  } else if (options.action === "mark_sent") {
    permission = "salesQuotation:send";
    assertTransition(QUOTATION_TRANSITIONS, status, "sent", options.action);
    nextStatus = "sent";
  } else if (options.action === "negotiate") {
    assertTransition(QUOTATION_TRANSITIONS, status, "negotiation", options.action);
    nextStatus = "negotiation";
  } else if (options.action === "accept") {
    assertTransition(QUOTATION_TRANSITIONS, status, "accepted", options.action);
    nextStatus = "accepted";
  } else if (options.action === "expire") {
    assertTransition(QUOTATION_TRANSITIONS, status, "expired", options.action);
    nextStatus = "expired";
  } else if (options.action === "cancel") {
    permission = "salesQuotation:cancel";
    assertTransition(QUOTATION_TRANSITIONS, status, "cancelled", options.action);
    nextStatus = "cancelled";
  }
  ensurePermission(options.session, permission);

  const next = {
    ...current,
    status: nextStatus,
    approvalStatus:
      options.action === "submit_approval"
        ? "pending"
        : options.action === "approve"
          ? nextStatus === "approved"
            ? "approved"
            : "pending"
          : options.action === "reject"
            ? "rejected"
            : current.approvalStatus,
    reviewedBy: options.action === "submit_review" ? options.session.uid : current.reviewedBy,
    approvedBy: nextStatus === "approved" ? options.session.uid : current.approvedBy,
    sentExternally: false,
    sentRecordedAt: options.action === "mark_sent" ? new Date().toISOString() : current.sentRecordedAt,
    ...actorStamp(options.session, current),
  };
  writes.push(writeOf(SALES_COLLECTIONS.quotations, options.id, next));
  await commitWrites(writes, options.idToken);
  await auditSales(options.idToken, options.session, {
    action: `QUOTATION_${options.action.toUpperCase()}`,
    resource: SALES_COLLECTIONS.quotations,
    resourceId: options.id,
    description: `Quotation ${text(current.quotationNumber)} → ${nextStatus}.`,
    reason: options.comment,
    oldData: { status },
    newData: { status: nextStatus },
  });
  return { id: options.id, record: next };
}

export async function convertQuotationToSalesOrder(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
  payload?: Record<string, unknown>;
}) {
  ensurePermission(options.session, "salesOrder:create");
  const quotation = await requireRecord(SALES_COLLECTIONS.quotations, options.id, options.idToken, "Quotation");
  if (!["accepted", "approved", "sent", "negotiation"].includes(text(quotation.status))) {
    fail("Only accepted, approved, sent, or negotiated quotations can be converted.");
  }
  if (text(quotation.status) === "converted" || text(quotation.convertedOrderId)) {
    fail("This quotation has already been converted to a sales order.");
  }
  const items = await listByField(SALES_COLLECTIONS.quotationItems, "quotationId", options.id, options.idToken);
  const activeItems = items.filter((item) => text(item.status) !== "superseded");
  const result = await createSalesOrder({
    payload: {
      customerId: text(quotation.customerId),
      orderType: "standard",
      orderDate: new Date().toISOString().slice(0, 10),
      quotationId: options.id,
      currency: text(quotation.currency) || "INR",
      paymentTerms: text(quotation.paymentTerms),
      requestedDeliveryDate: text(quotation.expectedDeliveryDate),
      salesRepresentative: text(quotation.salesRepresentative),
      customerRequirements: text(quotation.customerRequirements),
      customerNotes: text(quotation.customerNotes),
      internalNotes: text(quotation.internalNotes),
      ...options.payload,
      items: activeItems.map((item) => ({
        productId: text(item.productId),
        productCode: text(item.productCode),
        productName: text(item.productName),
        packSize: text(item.packSize),
        uom: text(item.uom),
        quantity: money(item.quantity),
        unitPrice: money(item.unitPrice),
        discount: money(item.discount),
        tax: money(item.tax),
        freight: money(item.freight),
        otherCharges: money(item.otherCharges),
        notes: text(item.notes),
      })),
    },
    session: options.session,
    idToken: options.idToken,
  });
  const nextQuotation = {
    ...quotation,
    status: "converted",
    convertedOrderId: result.id,
    convertedAt: new Date().toISOString(),
    ...actorStamp(options.session, quotation),
  };
  await commitWrites([writeOf(SALES_COLLECTIONS.quotations, options.id, nextQuotation)], options.idToken);
  return { quotation: nextQuotation, order: result };
}

/* -------------------------------------------------------------------------- */
/* Sales orders                                                               */
/* -------------------------------------------------------------------------- */

export async function createSalesOrder(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
  id?: string;
}) {
  ensurePermission(options.session, options.id ? "salesOrder:update" : "salesOrder:create");
  const data = parseOrFail(salesOrderSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const customer = await requireActiveCustomer(data.customerId, options.idToken);
  for (const item of data.items) await requireProduct(item.productId, options.idToken);
  const requirementCheck = await validateCustomerRequirements({
    customerId: data.customerId,
    productIds: data.items.map((item) => item.productId),
    idToken: options.idToken,
  });
  if (!requirementCheck.ok) {
    fail(requirementCheck.blockers.map((b) => b.label).join(" "));
  }
  const existing = options.id
    ? await requireRecord(SALES_COLLECTIONS.orders, options.id, options.idToken, "Sales order")
    : null;
  if (existing && text(existing.status) !== "draft") fail("Only draft sales orders can be edited.");
  const id = options.id || crypto.randomUUID();
  const numbered = existing
    ? { documentNumber: text(existing.salesOrderNumber) }
    : await issueSalesNumber("SO", options.session, options.idToken);
  const mapped = mapLineItems(data.items, { parentId: id, parentField: "salesOrderId" }, options.session);
  const totals = calculateDocumentTotals(
    mapped.map(({ record }) => ({
      quantity: record.quantity,
      unitPrice: record.unitPrice,
      discount: record.discount,
      tax: record.tax,
      freight: record.freight,
      otherCharges: record.otherCharges,
      lineTotal: record.lineTotal,
    }))
  );
  const writes: AtomicWrite[] = mapped.map(({ itemId, record }) =>
    writeOf(SALES_COLLECTIONS.orderItems, itemId, record, { exists: false })
  );
  if (existing) {
    const oldItems = await listByField(SALES_COLLECTIONS.orderItems, "salesOrderId", id, options.idToken);
    for (const old of oldItems) {
      writes.push(
        writeOf(SALES_COLLECTIONS.orderItems, String(old.id), {
          ...old,
          status: "superseded",
          ...actorStamp(options.session, old),
        })
      );
    }
  }
  const minShelfLifeMonths = extractMinShelfLifeMonths(requirementCheck.requirements, customer);
  const record = {
    salesOrderId: id,
    salesOrderNumber: numbered.documentNumber,
    customerId: data.customerId,
    orderType: data.orderType,
    orderDate: data.orderDate,
    customerPoNumber: data.customerPoNumber || "",
    quotationId: data.quotationId || "",
    contractOrderId: data.contractOrderId || "",
    currency: data.currency,
    paymentTerms: data.paymentTerms || text(customer.paymentTerms) || "",
    deliveryAddress: data.deliveryAddress || "",
    billingAddress: data.billingAddress || "",
    requestedDeliveryDate: data.requestedDeliveryDate || "",
    promisedDeliveryDate: data.promisedDeliveryDate || "",
    regulatoryMarket: data.regulatoryMarket || text(customer.market) || "",
    requiredDocuments: data.requiredDocuments || "",
    salesRepresentative: data.salesRepresentative || text(customer.salesRepresentative) || options.session.uid,
    customerRequirements: data.customerRequirements || "",
    internalNotes: data.internalNotes || "",
    customerNotes: data.customerNotes || "",
    warehouseId: data.warehouseId || "",
    plantId: data.plantId || "",
    minShelfLifeMonths,
    status: "draft",
    approvalStatus: "not_started",
    creditOverrideReason: data.creditOverrideReason || "",
    fulfilmentPercent: 0,
    remainingQuantity: mapped.reduce((sum, row) => sum + money(row.record.quantity), 0),
    version: Number(existing?.version || 0) + (existing ? 1 : 0) || 1,
    ...totals,
    searchIndex: searchIndex(numbered.documentNumber, data.customerId, data.customerPoNumber),
    ...actorStamp(options.session, existing || undefined),
  };
  writes.push(writeOf(SALES_COLLECTIONS.orders, id, record, { exists: existing ? undefined : false }));
  writes.push(
    statusHistoryWrite({
      documentType: "salesOrder",
      documentId: id,
      documentNumber: numbered.documentNumber,
      fromStatus: existing ? text(existing.status) : "",
      toStatus: "draft",
      reason: existing ? "Order revised" : "Order created",
      session: options.session,
    })
  );
  if (data.idempotencyKey) {
    writes.push(idempotencyWrite(data.idempotencyKey, { id, record, items: mapped.map((m) => m.record) }, options.session));
  }
  await commitWrites(writes, options.idToken);
  await auditSales(options.idToken, options.session, {
    action: existing ? "SALES_ORDER_UPDATED" : "SALES_ORDER_CREATED",
    resource: SALES_COLLECTIONS.orders,
    resourceId: id,
    description: `${existing ? "Updated" : "Created"} sales order ${numbered.documentNumber}.`,
  });
  return { id, record, items: mapped.map((m) => m.record) };
}

export async function submitSalesOrderForApproval(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  ensurePermission(options.session, "salesOrder:submit");
  const current = await requireRecord(SALES_COLLECTIONS.orders, options.id, options.idToken, "Sales order");
  assertTransition(ORDER_TRANSITIONS, text(current.status), "submitted", "submit");
  const settings = await loadSettings(options.idToken);
  const credit = await validateCustomerCredit({
    customerId: text(current.customerId),
    orderValue: money(current.grandTotal),
    idToken: options.idToken,
    utilizationThresholdPercent: settings.creditUtilizationThresholdPercent,
  });
  const discountNeedsApproval = requiresDiscountApproval(
    money(current.subtotal),
    money(current.discount),
    settings.discountApprovalThresholdPercent
  );
  const requireFinance =
    money(current.grandTotal) >= settings.financeReviewOrderValue ||
    !credit.allowed ||
    credit.warnings.length > 0;
  const isExport = text(current.orderType) === "export" || Boolean(text(current.regulatoryMarket));
  const requireQa = (isExport && settings.requireQaReviewForExport) || text(current.orderType) === "contract_manufacturing";
  const requireRegulatory = isExport && settings.requireRegulatoryReviewForExport;
  if (!credit.allowed && !text(current.creditOverrideReason)) {
    fail(`${credit.reasons.join(" ")} Provide an authorized credit override reason or create a credit review.`);
  }
  const workflow = await loadWorkflowConfig(WORKFLOW_MODULES.salesOrder, options.idToken);
  const steps = filterOrderApprovalSteps(workflow.steps, {
    requireFinance: requireFinance || discountNeedsApproval,
    requireQa,
    requireRegulatory,
  });
  const { writes: approvalWrites } = await startApprovals({
    module: WORKFLOW_MODULES.salesOrder,
    documentType: "salesOrder",
    documentId: options.id,
    documentNumber: text(current.salesOrderNumber),
    requestedBy: options.session.uid,
    session: options.session,
    idToken: options.idToken,
    steps,
  });
  const nextStatus = steps.length ? "pending_approval" : "approved";
  const next = {
    ...current,
    status: nextStatus,
    approvalStatus: steps.length ? "pending" : "approved",
    submittedBy: options.session.uid,
    submittedAt: new Date().toISOString(),
    creditCheck: credit,
    discountPercent: discountPercent(current.subtotal, current.discount),
    riskFlags: {
      discountNeedsApproval,
      requireFinance,
      requireQa,
      requireRegulatory,
      creditBlocked: !credit.allowed,
    },
    ...actorStamp(options.session, current),
  };
  const writes: AtomicWrite[] = [
    writeOf(SALES_COLLECTIONS.orders, options.id, next),
    ...approvalWrites,
    statusHistoryWrite({
      documentType: "salesOrder",
      documentId: options.id,
      documentNumber: text(current.salesOrderNumber),
      fromStatus: text(current.status),
      toStatus: nextStatus,
      reason: options.reason || "Submitted for approval",
      session: options.session,
    }),
  ];
  await commitWrites(writes, options.idToken);
  await notifySales(options.idToken, options.session, {
    type: "sales_order_pending_approval",
    title: "Sales order pending approval",
    message: `Sales order ${text(current.salesOrderNumber)} awaits commercial approval.`,
    resource: SALES_COLLECTIONS.orders,
    resourceId: options.id,
    audienceRoles: ["sales", "finance", "management"],
  });
  await auditSales(options.idToken, options.session, {
    action: "SALES_ORDER_SUBMITTED",
    resource: SALES_COLLECTIONS.orders,
    resourceId: options.id,
    description: `Submitted sales order ${text(current.salesOrderNumber)} for approval.`,
    reason: options.reason,
  });
  return { id: options.id, record: next, credit };
}

export async function approveSalesOrder(options: {
  id: string;
  action: "approve" | "reject" | "return";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "salesOrder:approve");
  const current = await requireRecord(SALES_COLLECTIONS.orders, options.id, options.idToken, "Sales order");
  if (!["pending_approval", "under_review", "submitted"].includes(text(current.status))) {
    fail(`Cannot ${options.action} a sales order in "${text(current.status)}" status.`);
  }
  const result = await handleApproval({
    documentType: "salesOrder",
    documentId: options.id,
    action: options.action,
    comment: options.comment,
    session: options.session,
    idToken: options.idToken,
    module: WORKFLOW_MODULES.salesOrder,
  });
  const nextStatus = result.rejected
    ? "draft"
    : result.returned
      ? "under_review"
      : result.completed
        ? "approved"
        : "pending_approval";
  const next = {
    ...current,
    status: nextStatus,
    approvalStatus: result.rejected
      ? "rejected"
      : result.returned
        ? "returned"
        : result.completed
          ? "approved"
          : "pending",
    approvedBy: result.completed ? options.session.uid : current.approvedBy,
    approvedAt: result.completed ? new Date().toISOString() : current.approvedAt,
    ...actorStamp(options.session, current),
  };
  await commitWrites(
    [
      writeOf(SALES_COLLECTIONS.orders, options.id, next),
      ...result.writes,
      statusHistoryWrite({
        documentType: "salesOrder",
        documentId: options.id,
        documentNumber: text(current.salesOrderNumber),
        fromStatus: text(current.status),
        toStatus: nextStatus,
        reason: options.comment || options.action,
        session: options.session,
      }),
    ],
    options.idToken
  );
  await auditSales(options.idToken, options.session, {
    action: `SALES_ORDER_${options.action.toUpperCase()}`,
    resource: SALES_COLLECTIONS.orders,
    resourceId: options.id,
    description: `Sales order ${text(current.salesOrderNumber)} approval action: ${options.action}.`,
    reason: options.comment,
  });
  return { id: options.id, record: next };
}

export async function confirmSalesOrder(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  ensurePermission(options.session, "salesOrder:confirm");
  const current = await requireRecord(SALES_COLLECTIONS.orders, options.id, options.idToken, "Sales order");
  assertTransition(ORDER_TRANSITIONS, text(current.status), "confirmed", "confirm");
  const settings = await loadSettings(options.idToken);
  const credit = await validateCustomerCredit({
    customerId: text(current.customerId),
    orderValue: money(current.grandTotal),
    idToken: options.idToken,
    utilizationThresholdPercent: settings.creditUtilizationThresholdPercent,
  });
  if (!credit.allowed && !text(current.creditOverrideReason)) {
    fail(credit.reasons.join(" ") || "Credit check failed.");
  }
  const next = {
    ...current,
    status: "confirmed",
    confirmedBy: options.session.uid,
    confirmedAt: new Date().toISOString(),
    creditCheck: credit,
    ...actorStamp(options.session, current),
  };
  await commitWrites(
    [
      writeOf(SALES_COLLECTIONS.orders, options.id, next),
      statusHistoryWrite({
        documentType: "salesOrder",
        documentId: options.id,
        documentNumber: text(current.salesOrderNumber),
        fromStatus: text(current.status),
        toStatus: "confirmed",
        reason: options.reason || "Commercial confirmation",
        session: options.session,
      }),
    ],
    options.idToken
  );
  await auditSales(options.idToken, options.session, {
    action: "SALES_ORDER_CONFIRMED",
    resource: SALES_COLLECTIONS.orders,
    resourceId: options.id,
    description: `Confirmed sales order ${text(current.salesOrderNumber)}.`,
    reason: options.reason,
  });
  return { id: options.id, record: next };
}

export async function transitionSalesOrder(options: {
  id: string;
  toStatus: string;
  reason?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "salesOrder:update");
  const current = await requireRecord(SALES_COLLECTIONS.orders, options.id, options.idToken, "Sales order");
  assertTransition(ORDER_TRANSITIONS, text(current.status), options.toStatus, options.toStatus);
  if (isLockedOrderStatus(text(current.status)) && options.toStatus === "draft") {
    fail("Dispatched or delivered orders cannot be reset to draft.");
  }
  const next = {
    ...current,
    status: options.toStatus,
    ...actorStamp(options.session, current),
  };
  await commitWrites(
    [
      writeOf(SALES_COLLECTIONS.orders, options.id, next),
      statusHistoryWrite({
        documentType: "salesOrder",
        documentId: options.id,
        documentNumber: text(current.salesOrderNumber),
        fromStatus: text(current.status),
        toStatus: options.toStatus,
        reason: options.reason || "",
        session: options.session,
      }),
    ],
    options.idToken
  );
  await auditSales(options.idToken, options.session, {
    action: "SALES_ORDER_STATUS_CHANGED",
    resource: SALES_COLLECTIONS.orders,
    resourceId: options.id,
    description: `Sales order ${text(current.salesOrderNumber)}: ${text(current.status)} → ${options.toStatus}.`,
    reason: options.reason,
    oldData: { status: current.status },
    newData: { status: options.toStatus },
  });
  return { id: options.id, record: next };
}

export async function checkOrderInventoryAvailability(options: {
  id: string;
  warehouseId?: string;
  idToken: string;
}) {
  const order = await requireRecord(SALES_COLLECTIONS.orders, options.id, options.idToken, "Sales order");
  const warehouseId = options.warehouseId || text(order.warehouseId);
  if (!warehouseId) fail("Warehouse is required for availability check.");
  const lines = (await listByField(SALES_COLLECTIONS.orderItems, "salesOrderId", options.id, options.idToken)).filter(
    (line) => text(line.status) !== "superseded"
  );
  const results = [];
  for (const line of lines) {
    const needed = money(line.remainingQuantity ?? line.quantity) - money(line.allocatedQuantity);
    const balances = await queryMasterDocuments(INVENTORY_COLLECTIONS.balances, options.idToken, {
      filters: [
        { field: "itemId", value: text(line.productId) },
        { field: "warehouseId", value: warehouseId },
        { field: "qualityStatus", value: "approved" },
      ],
      limit: 80,
    });
    const candidates = balances
      .filter((row) => !["hold", "quarantine", "recalled", "rejected", "expired"].includes(text(row.inventoryStatus)))
      .map((row) => ({
        id: row.id,
        inventoryBatchId: text(row.inventoryBatchId),
        itemId: text(row.itemId),
        itemType: text(row.itemType) || "product",
        batchNumber: text(row.batchNumber),
        lotNumber: text(row.lotNumber),
        warehouseId: text(row.warehouseId),
        locationId: text(row.locationId),
        qualityStatus: text(row.qualityStatus),
        inventoryStatus: text(row.inventoryStatus),
        availableQuantity: Number(row.availableQuantity || 0),
        expiryDate: text(row.expiryDate) || null,
        uom: text(row.uom),
      }));
    const minMonths = Number(order.minShelfLifeMonths || 0);
    const selection = selectFEFOInventory(candidates, Math.max(needed, 0), {
      warehouseId,
      minRemainingDays: minMonths ? minMonths * 30 : undefined,
    });
    const eligibleQty = selection.allocations.reduce((sum, row) => sum + Number(row.allocatedQuantity || 0), 0);
    const shelfBlocked = candidates.filter((row) => minMonths && !validateShelfLife(row.expiryDate, minMonths).allowed);
    results.push({
      lineId: String(line.id),
      productId: text(line.productId),
      neededQuantity: Math.max(needed, 0),
      availableEligibleQuantity: money(eligibleQty),
      shortageQuantity: money(Math.max(0, needed - eligibleQty)),
      options:
        needed > eligibleQty
          ? ["wait_for_production", "partial_fulfilment", "authorized_alternative"]
          : ["allocate_via_warehouse"],
      note:
        needed > eligibleQty
          ? "Insufficient eligible QA-released inventory. No silent product/batch substitution is performed."
          : "Eligible inventory is available for warehouse allocation.",
      shelfLifeBlockedBatches: shelfBlocked.length,
    });
  }
  return { salesOrderId: options.id, warehouseId, lines: results };
}

export async function allocateSalesOrderInventory(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
  warehouseId?: string;
  lineId?: string;
  quantity?: number;
}) {
  ensurePermission(options.session, "salesOrder:update");
  const order = await requireRecord(SALES_COLLECTIONS.orders, options.id, options.idToken, "Sales order");
  if (
    !["confirmed", "ready_for_dispatch", "partially_fulfilled", "in_production", "awaiting_qa_release"].includes(
      text(order.status)
    )
  ) {
    fail("Inventory can only be allocated for confirmed or fulfilment-stage orders.");
  }
  const availability = await checkOrderInventoryAvailability({
    id: options.id,
    warehouseId: options.warehouseId || text(order.warehouseId),
    idToken: options.idToken,
  });
  const lines = (await listByField(SALES_COLLECTIONS.orderItems, "salesOrderId", options.id, options.idToken)).filter(
    (line) => text(line.status) !== "superseded"
  );
  const targetLines = options.lineId
    ? lines.filter((line) => String(line.id) === options.lineId || text(line.lineId) === options.lineId)
    : lines;
  if (!targetLines.length) fail("No order lines available for allocation.");
  const warehouseId = availability.warehouseId;
  const writes: AtomicWrite[] = [];
  const allocationResults: Array<{
    allocationId: string;
    salesOrderId: string;
    salesOrderLineId: string;
    productId: string;
    warehouseId: string;
    quantity: number;
    pickId: string;
    status: string;
  }> = [];
  for (const line of targetLines) {
    const availabilityLine = availability.lines.find((row) => row.lineId === String(line.id));
    const remaining = money(line.remainingQuantity ?? line.quantity) - money(line.allocatedQuantity);
    const qty = options.quantity != null ? money(options.quantity) : remaining;
    if (qty <= 0) continue;
    if (!availabilityLine || availabilityLine.availableEligibleQuantity < qty) {
      fail(
        `Insufficient eligible inventory for ${text(line.productCode) || text(line.productId)}. Consider waiting for production, partial fulfilment, or an authorized alternative. No silent substitution is performed.`
      );
    }
    const pick = await allocateInventory({
      payload: {
        warehouseId,
        customerId: text(order.customerId),
        orderId: options.id,
        productId: text(line.productId),
        quantity: qty,
        minShelfLifeMonths: Number(order.minShelfLifeMonths || 0),
        idempotencyKey: `so-alloc-${options.id}-${String(line.id)}-${qty}`,
      },
      session: options.session,
      idToken: options.idToken,
    });
    const allocationId = crypto.randomUUID();
    const allocationRecord = {
      allocationId,
      salesOrderId: options.id,
      salesOrderLineId: String(line.id),
      productId: text(line.productId),
      warehouseId,
      quantity: qty,
      pickId: pick.id,
      status: "allocated",
      ...actorStamp(options.session),
    };
    writes.push(writeOf(SALES_COLLECTIONS.orderAllocations, allocationId, allocationRecord, { exists: false }));
    writes.push(
      writeOf(SALES_COLLECTIONS.orderItems, String(line.id), {
        ...line,
        reservedQuantity: money(money(line.reservedQuantity) + qty),
        allocatedQuantity: money(money(line.allocatedQuantity) + qty),
        remainingQuantity: money(
          money(line.orderedQuantity ?? line.quantity) - money(line.dispatchedQuantity) - money(line.allocatedQuantity) - qty
        ),
        ...actorStamp(options.session, line),
      })
    );
    allocationResults.push(allocationRecord);
  }
  if (!allocationResults.length) fail("No quantity remained to allocate.");
  const refreshed = lines.map((line) => {
    const alloc = allocationResults.find((row) => row.salesOrderLineId === String(line.id));
    if (!alloc) return line;
    return {
      ...line,
      reservedQuantity: money(money(line.reservedQuantity) + money(alloc.quantity)),
      allocatedQuantity: money(money(line.allocatedQuantity) + money(alloc.quantity)),
    };
  });
  const fulfilment = calculateOrderFulfilment(refreshed);
  writes.push(
    writeOf(SALES_COLLECTIONS.orders, options.id, {
      ...order,
      fulfilmentPercent: fulfilment.fulfilmentPercent,
      remainingQuantity: fulfilment.remainingQuantity,
      status: fulfilment.remainingQuantity < fulfilment.orderedQuantity ? "partially_fulfilled" : text(order.status),
      ...actorStamp(options.session, order),
    })
  );
  await commitWrites(writes, options.idToken);
  await auditSales(options.idToken, options.session, {
    action: "SALES_ORDER_ALLOCATED",
    resource: SALES_COLLECTIONS.orders,
    resourceId: options.id,
    description: `Allocated inventory via warehouse pick for sales order ${text(order.salesOrderNumber)}.`,
  });
  return { id: options.id, allocations: allocationResults, picks: allocationResults.map((row) => row.pickId) };
}

export async function requestOrderChange(options: {
  id: string;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "salesOrder:update");
  const data = parseOrFail(orderChangeSchema, options.payload);
  const order = await requireRecord(SALES_COLLECTIONS.orders, options.id, options.idToken, "Sales order");
  if (isLockedOrderStatus(text(order.status))) {
    fail("Dispatched or delivered orders cannot be changed directly. Use returns or commercial adjustments.");
  }
  if (["in_production", "awaiting_qa_release", "ready_for_dispatch", "partially_fulfilled"].includes(text(order.status))) {
    fail("This order has fulfilment activity. Route the change through an authorized amendment workflow.");
  }
  const changeId = crypto.randomUUID();
  const change = {
    changeId,
    salesOrderId: options.id,
    field: data.field,
    previousValue: data.previousValue ?? order[data.field],
    newValue: data.newValue,
    reason: data.reason,
    impactAssessment: data.impactAssessment || "",
    requestedBy: options.session.uid,
    approvalStatus: ["draft", "submitted"].includes(text(order.status)) ? "applied" : "pending",
    approvedBy: ["draft", "submitted"].includes(text(order.status)) ? options.session.uid : "",
    effectiveDate: new Date().toISOString().slice(0, 10),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(SALES_COLLECTIONS.orderChanges, changeId, change, { exists: false })];
  if (change.approvalStatus === "applied") {
    writes.push(
      writeOf(SALES_COLLECTIONS.orders, options.id, {
        ...order,
        [data.field]: data.newValue,
        ...actorStamp(options.session, order),
      })
    );
  }
  await commitWrites(writes, options.idToken);
  await auditSales(options.idToken, options.session, {
    action: "SALES_ORDER_CHANGE_REQUESTED",
    resource: SALES_COLLECTIONS.orders,
    resourceId: options.id,
    description: `Change requested on ${data.field} for ${text(order.salesOrderNumber)}.`,
    reason: data.reason,
    oldData: { [data.field]: change.previousValue },
    newData: { [data.field]: data.newValue },
  });
  return { id: changeId, record: change };
}

export async function cancelSalesOrder(options: {
  id: string;
  reason: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "salesOrder:cancel");
  if (!options.reason?.trim()) fail("Cancellation reason is required.");
  const current = await requireRecord(SALES_COLLECTIONS.orders, options.id, options.idToken, "Sales order");
  if (["dispatched", "partially_delivered", "delivered", "closed"].includes(text(current.status))) {
    fail("Dispatched or delivered orders cannot be cancelled. Use the sales return workflow.");
  }
  assertTransition(ORDER_TRANSITIONS, text(current.status), "cancelled", "cancel");
  const links = await loadOrderLogisticsLinks(options.id, options.idToken);
  const activeReservations = links.reservations.filter((row) => text(row.status) === "reserved");
  if (activeReservations.length) {
    // Do not mutate inventory quantities here; mark sales-side release intent for warehouse action.
  }
  const lines = await listByField(SALES_COLLECTIONS.orderItems, "salesOrderId", options.id, options.idToken);
  const writes: AtomicWrite[] = [
    writeOf(SALES_COLLECTIONS.orders, options.id, {
      ...current,
      status: "cancelled",
      cancellationReason: options.reason,
      cancelledBy: options.session.uid,
      cancelledAt: new Date().toISOString(),
      reservationReleaseRequired: activeReservations.length > 0,
      ...actorStamp(options.session, current),
    }),
    ...lines.map((line) =>
      writeOf(SALES_COLLECTIONS.orderItems, String(line.id), {
        ...line,
        remainingQuantity: 0,
        ...actorStamp(options.session, line),
      })
    ),
    ...links.allocations.map((alloc) =>
      writeOf(SALES_COLLECTIONS.orderAllocations, String(alloc.id), {
        ...alloc,
        status: "release_requested",
        ...actorStamp(options.session, alloc),
      })
    ),
    statusHistoryWrite({
      documentType: "salesOrder",
      documentId: options.id,
      documentNumber: text(current.salesOrderNumber),
      fromStatus: text(current.status),
      toStatus: "cancelled",
      reason: options.reason,
      session: options.session,
    }),
  ];
  await commitWrites(writes, options.idToken);
  await auditSales(options.idToken, options.session, {
    action: "SALES_ORDER_CANCELLED",
    resource: SALES_COLLECTIONS.orders,
    resourceId: options.id,
    description: `Cancelled sales order ${text(current.salesOrderNumber)}.`,
    reason: options.reason,
    severity: "warning",
  });
  return { id: options.id, reservationReleaseRequired: activeReservations.length > 0 };
}

export async function closeSalesOrder(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  ensurePermission(options.session, "salesOrder:close");
  const current = await requireRecord(SALES_COLLECTIONS.orders, options.id, options.idToken, "Sales order");
  const lines = await listByField(SALES_COLLECTIONS.orderItems, "salesOrderId", options.id, options.idToken);
  const fulfilment = calculateOrderFulfilment(lines.filter((line) => text(line.status) !== "superseded"));
  const closure = canCloseOrder(current, fulfilment);
  if (!closure.allowed) fail(closure.reason);
  assertTransition(ORDER_TRANSITIONS, text(current.status), "closed", "close");
  const next = {
    ...current,
    status: "closed",
    fulfilmentPercent: fulfilment.fulfilmentPercent,
    closedBy: options.session.uid,
    closedAt: new Date().toISOString(),
    ...actorStamp(options.session, current),
  };
  await commitWrites(
    [
      writeOf(SALES_COLLECTIONS.orders, options.id, next),
      statusHistoryWrite({
        documentType: "salesOrder",
        documentId: options.id,
        documentNumber: text(current.salesOrderNumber),
        fromStatus: text(current.status),
        toStatus: "closed",
        reason: options.reason || "Order closed",
        session: options.session,
      }),
    ],
    options.idToken
  );
  return { id: options.id, record: next };
}

export async function getSalesOrderDetailExtras(options: {
  id: string;
  idToken: string;
}) {
  const order = await requireRecord(SALES_COLLECTIONS.orders, options.id, options.idToken, "Sales order");
  const [items, approvals, history, changes, requirements, credit, links, communications, returns] =
    await Promise.all([
      listByField(SALES_COLLECTIONS.orderItems, "salesOrderId", options.id, options.idToken),
      loadApprovals(options.id, options.idToken),
      listByField(SALES_COLLECTIONS.orderStatusHistory, "documentId", options.id, options.idToken),
      listByField(SALES_COLLECTIONS.orderChanges, "salesOrderId", options.id, options.idToken),
      validateCustomerRequirements({
        customerId: text(order.customerId),
        productIds: [],
        idToken: options.idToken,
      }),
      validateCustomerCredit({
        customerId: text(order.customerId),
        orderValue: money(order.grandTotal),
        idToken: options.idToken,
      }),
      loadOrderLogisticsLinks(options.id, options.idToken),
      listByField(SALES_COLLECTIONS.communications, "relatedId", options.id, options.idToken),
      listByField(SALES_COLLECTIONS.returns, "salesOrderId", options.id, options.idToken),
    ]);
  const activeItems = items.filter((item) => text(item.status) !== "superseded");
  const fulfilment = calculateOrderFulfilment(activeItems);
  const blockers = deriveOrderBlockers({
    order,
    creditAllowed: credit.allowed || Boolean(text(order.creditOverrideReason)),
    creditReasons: credit.reasons,
    requirementBlockers: requirements.blockers,
    stockShortages: [],
    pendingApprovals: approvals.filter((row) => text(row.status) === "pending").length,
  });
  return {
    items: activeItems,
    approvals,
    history,
    changes,
    requirements: requirements.requirements,
    credit,
    fulfilment,
    blockers,
    logistics: links,
    communications,
    returns,
  };
}

/* -------------------------------------------------------------------------- */
/* Contract manufacturing                                                     */
/* -------------------------------------------------------------------------- */

export async function createContractManufacturingOrder(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "contractManufacturing:create");
  const data = parseOrFail(contractManufacturingOrderSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireActiveCustomer(data.customerId, options.idToken);
  await requireProduct(data.productId, options.idToken);
  if (data.bomId) {
    const bom = await requireRecord(PRODUCTION_COLLECTIONS.boms, data.bomId, options.idToken, "BOM");
    if (!["approved", "active"].includes(text(bom.status))) {
      fail("Only approved BOM / formulation references can be linked. Sales cannot modify formulations.");
    }
  }
  if (data.specificationId) {
    const spec = await readMasterDocument("productSpecifications", data.specificationId, options.idToken);
    if (spec && !["approved", "active"].includes(text(spec.status))) {
      fail("Linked product specification is not approved.");
    }
  }
  const id = crypto.randomUUID();
  const numbered = await issueSalesNumber("CMO", options.session, options.idToken);
  const record = {
    contractOrderId: id,
    contractOrderNumber: numbered.documentNumber,
    ...data,
    status: "draft",
    approvalStatus: "not_started",
    productionAuthorized: false,
    searchIndex: searchIndex(numbered.documentNumber, data.customerId, data.productId),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(SALES_COLLECTIONS.contractOrders, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditSales(options.idToken, options.session, {
    action: "CMO_CREATED",
    resource: SALES_COLLECTIONS.contractOrders,
    resourceId: id,
    description: `Created contract manufacturing order ${numbered.documentNumber}.`,
  });
  return { id, record };
}

export async function transitionContractOrder(options: {
  id: string;
  action: "submit" | "approve" | "reject" | "confirm_commercial" | "link_production" | "cancel";
  comment?: string;
  productionPlanId?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const current = await requireRecord(
    SALES_COLLECTIONS.contractOrders,
    options.id,
    options.idToken,
    "Contract manufacturing order"
  );
  const writes: AtomicWrite[] = [];
  let nextStatus = text(current.status);
  let productionAuthorized = Boolean(current.productionAuthorized);

  if (options.action === "submit") {
    ensurePermission(options.session, "contractManufacturing:submit");
    assertTransition(CMO_TRANSITIONS, text(current.status), "submitted", "submit");
    nextStatus = "submitted";
    const { writes: approvalWrites } = await startApprovals({
      module: WORKFLOW_MODULES.contractManufacturing,
      documentType: "contractManufacturingOrder",
      documentId: options.id,
      documentNumber: text(current.contractOrderNumber),
      requestedBy: options.session.uid,
      session: options.session,
      idToken: options.idToken,
    });
    writes.push(...approvalWrites);
  } else if (options.action === "approve" || options.action === "reject") {
    ensurePermission(options.session, "contractManufacturing:approve");
    const result = await handleApproval({
      documentType: "contractManufacturingOrder",
      documentId: options.id,
      action: options.action,
      comment: options.comment,
      session: options.session,
      idToken: options.idToken,
      module: WORKFLOW_MODULES.contractManufacturing,
    });
    writes.push(...result.writes);
    if (result.rejected) nextStatus = "cancelled";
    else if (result.completed) nextStatus = "commercially_confirmed";
    else nextStatus = "technical_review";
  } else if (options.action === "confirm_commercial") {
    ensurePermission(options.session, "contractManufacturing:approve");
    assertTransition(CMO_TRANSITIONS, text(current.status), "commercially_confirmed", options.action);
    nextStatus = "commercially_confirmed";
  } else if (options.action === "link_production") {
    ensurePermission(options.session, "contractManufacturing:update");
    assertTransition(CMO_TRANSITIONS, text(current.status), "linked_to_production", options.action);
    if (text(current.status) !== "commercially_confirmed") {
      fail("Commercial confirmation and technical/regulatory/QA approvals are required before production linkage.");
    }
    nextStatus = "linked_to_production";
    productionAuthorized = true;
  } else if (options.action === "cancel") {
    ensurePermission(options.session, "contractManufacturing:cancel");
    assertTransition(CMO_TRANSITIONS, text(current.status), "cancelled", "cancel");
    nextStatus = "cancelled";
    productionAuthorized = false;
  }

  const next = {
    ...current,
    status: nextStatus,
    productionAuthorized,
    productionPlanId: options.productionPlanId || current.productionPlanId || "",
    ...actorStamp(options.session, current),
  };
  writes.push(writeOf(SALES_COLLECTIONS.contractOrders, options.id, next));
  await commitWrites(writes, options.idToken);
  return { id: options.id, record: next };
}

/* -------------------------------------------------------------------------- */
/* Returns / requirements / communications / credit / documents / settings    */
/* -------------------------------------------------------------------------- */

export async function createSalesReturn(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "salesReturn:create");
  const data = parseOrFail(salesReturnSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const order = await requireRecord(SALES_COLLECTIONS.orders, data.salesOrderId, options.idToken, "Sales order");
  if (text(order.customerId) !== data.customerId) fail("Return customer must match the sales order customer.");
  await requireProduct(data.productId, options.idToken);
  const id = crypto.randomUUID();
  const numbered = await issueSalesNumber("SR", options.session, options.idToken);
  const record = {
    returnId: id,
    returnNumber: numbered.documentNumber,
    ...data,
    status: "requested",
    inventoryDisposition: "quarantine_required",
    autoRestock: false,
    searchIndex: searchIndex(numbered.documentNumber, data.customerId, data.salesOrderId),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(SALES_COLLECTIONS.returns, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditSales(options.idToken, options.session, {
    action: "SALES_RETURN_CREATED",
    resource: SALES_COLLECTIONS.returns,
    resourceId: id,
    description: `Created sales return ${numbered.documentNumber}.`,
    reason: data.reason,
  });
  return { id, record };
}

export async function transitionSalesReturn(options: {
  id: string;
  toStatus: string;
  resolution?: string;
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "salesReturn:update");
  const current = await requireRecord(SALES_COLLECTIONS.returns, options.id, options.idToken, "Sales return");
  assertTransition(RETURN_TRANSITIONS, text(current.status), options.toStatus, options.toStatus);
  if (["received", "quarantine", "qa_disposition"].includes(options.toStatus)) {
    ensurePermission(options.session, "salesReturn:approve");
  }
  if (options.toStatus === "closed" && text(current.inventoryDisposition) !== "qa_authorized") {
    // Closure of commercial resolution is allowed; inventory restock remains blocked unless QA authorized.
  }
  const next = {
    ...current,
    status: options.toStatus,
    resolution: options.resolution || current.resolution || "",
    inventoryDisposition:
      options.toStatus === "quarantine" || options.toStatus === "received"
        ? "quarantine"
        : options.toStatus === "qa_disposition"
          ? "qa_authorized"
          : current.inventoryDisposition,
    autoRestock: false,
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(SALES_COLLECTIONS.returns, options.id, next)], options.idToken);
  await auditSales(options.idToken, options.session, {
    action: "SALES_RETURN_STATUS_CHANGED",
    resource: SALES_COLLECTIONS.returns,
    resourceId: options.id,
    description: `Sales return ${text(current.returnNumber)} → ${options.toStatus}.`,
    reason: options.comment,
  });
  return { id: options.id, record: next };
}

export async function createCustomerRequirement(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "salesRequirement:create");
  const data = parseOrFail(salesRequirementSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireActiveCustomer(data.customerId, options.idToken);
  if (data.productId) await requireProduct(data.productId, options.idToken);
  const id = crypto.randomUUID();
  const numbered = await issueSalesNumber("REQ", options.session, options.idToken);
  const needsControlled =
    data.affectsManufacturing || data.affectsQuality || data.affectsRegulatory;
  const record = {
    requirementId: id,
    requirementNumber: numbered.documentNumber,
    ...data,
    owner: data.owner || options.session.uid,
    status: "draft",
    controlledWorkflowStatus: needsControlled ? "pending_routing" : "",
    searchIndex: searchIndex(numbered.documentNumber, data.customerId, data.title),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(SALES_COLLECTIONS.requirements, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function transitionRequirement(options: {
  id: string;
  toStatus: string;
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  ensurePermission(options.session, "salesRequirement:approve");
  const current = await requireRecord(SALES_COLLECTIONS.requirements, options.id, options.idToken, "Requirement");
  assertTransition(REQUIREMENT_TRANSITIONS, text(current.status), options.toStatus, options.toStatus);
  if (
    ["approved", "active"].includes(options.toStatus) &&
    (current.affectsManufacturing || current.affectsQuality || current.affectsRegulatory) &&
    text(current.controlledWorkflowStatus) === "pending_routing"
  ) {
    fail(
      "This requirement affects manufacturing, quality, or regulatory controls. Route it through the appropriate controlled workflow before activation. Approved specifications are not modified automatically."
    );
  }
  const next = {
    ...current,
    status: options.toStatus,
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(SALES_COLLECTIONS.requirements, options.id, next)], options.idToken);
  await auditSales(options.idToken, options.session, {
    action: "CUSTOMER_REQUIREMENT_STATUS_CHANGED",
    resource: SALES_COLLECTIONS.requirements,
    resourceId: options.id,
    description: `Requirement ${text(current.requirementNumber)} → ${options.toStatus}.`,
    reason: options.reason,
  });
  return { id: options.id, record: next };
}

export async function createSalesCommunication(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "sales:update");
  const data = parseOrFail(salesCommunicationSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireActiveCustomer(data.customerId, options.idToken);
  const id = crypto.randomUUID();
  const deliveryStatus =
    data.deliveryStatus === "queued" ? "pending_external" : data.deliveryStatus || "recorded";
  const record = {
    communicationId: id,
    ...data,
    deliveryStatus,
    externalDeliveryConfirmed: false,
    recordedBy: options.session.uid,
    searchIndex: searchIndex(data.customerId, data.subject, data.relatedId),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(SALES_COLLECTIONS.communications, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function createCreditReview(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "salesCredit:create");
  const data = parseOrFail(salesCreditReviewSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireActiveCustomer(data.customerId, options.idToken);
  const id = crypto.randomUUID();
  const numbered = await issueSalesNumber("CR", options.session, options.idToken);
  const { writes: approvalWrites } = data.overrideRequested
    ? await startApprovals({
        module: WORKFLOW_MODULES.salesCreditOverride,
        documentType: "salesCreditReview",
        documentId: id,
        documentNumber: numbered.documentNumber,
        requestedBy: options.session.uid,
        session: options.session,
        idToken: options.idToken,
      })
    : { writes: [] as AtomicWrite[] };
  const record = {
    creditReviewId: id,
    creditReviewNumber: numbered.documentNumber,
    ...data,
    status: "pending",
    searchIndex: searchIndex(numbered.documentNumber, data.customerId, data.salesOrderId),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [
    writeOf(SALES_COLLECTIONS.creditReviews, id, record, { exists: false }),
    ...approvalWrites,
  ];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function saveReceivableSnapshot(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "salesCredit:create");
  const data = parseOrFail(salesReceivableSnapshotSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireActiveCustomer(data.customerId, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    receivableId: id,
    ...data,
    paymentConfirmed: false,
    note: "Reference snapshot only. Not a full accounting ledger. Payment is not claimed unless confirmed by Finance.",
    searchIndex: searchIndex(data.customerId, data.asOfDate),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(SALES_COLLECTIONS.receivables, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function saveSalesDocument(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "salesOrder:update");
  const data = parseOrFail(salesDocumentSchema, options.payload);
  const id = crypto.randomUUID();
  const record = {
    documentId: id,
    ...data,
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(SALES_COLLECTIONS.documents, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function saveSalesSettings(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "sales:update");
  const data = parseOrFail(salesSettingsSchema, options.payload);
  const existing = await queryMasterDocuments(SALES_COLLECTIONS.settings, options.idToken, { limit: 1 });
  const id = existing[0] ? String(existing[0].id) : "default";
  const record = {
    settingsId: id,
    ...data,
    ...actorStamp(options.session, existing[0]),
  };
  await commitWrites(
    [writeOf(SALES_COLLECTIONS.settings, id, record, { exists: existing[0] ? undefined : false })],
    options.idToken
  );
  return { id, record };
}
