import { searchIndex } from "@/lib/inventory/keys";
import {
  applyApprovalAction,
  createApprovalWrites,
  loadApprovals,
  loadWorkflowConfig,
  type ProcurementWorkflowModule,
} from "@/lib/procurement/approvals";
import { PROCUREMENT_COLLECTIONS } from "@/lib/procurement/collections";
import { DEFAULT_OVER_RECEIPT_TOLERANCE_PERCENT, WORKFLOW_MODULES } from "@/lib/procurement/config";
import {
  actorStamp,
  auditProcurement,
  commitWrites,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueProcurementNumber,
  listByField,
  notifyProcurement,
  parseOrFail,
  requireRecord,
  reuseIdempotent,
  text,
  workflowFail,
  writeOf,
} from "@/lib/procurement/helpers";
import { materialLabel, requireEligibleMaterial, requireEligibleVendor } from "@/lib/procurement/lookups";
import { calculateDocumentTotals, calculateLineTotal, money } from "@/lib/procurement/money";
import { vendorProcurementEventWrite } from "@/lib/procurement/performance";
import { canTransition, PO_TRANSITIONS, PR_TRANSITIONS, QUOTATION_TRANSITIONS, RFQ_TRANSITIONS } from "@/lib/procurement/status";
import { queryMasterDocuments, readMasterDocument, type AtomicWrite } from "@/lib/masters/firestore";
import {
  materialRequirementSchema,
  procurementDocumentSchema,
  purchaseOrderAmendmentSchema,
  purchaseOrderSchema,
  purchaseRequisitionSchema,
  rfqSchema,
  vendorQuotationSchema,
  vendorSelectionSchema,
} from "@/lib/validation/procurement";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";

function assertTransition(map: Record<string, string[]>, current: string, next: string, action: string) {
  if (!canTransition(map, current, next)) workflowFail(current, action);
}

async function startApprovals(options: {
  module: ProcurementWorkflowModule;
  documentType: string;
  documentId: string;
  documentNumber: string;
  requestedBy: string;
  session: SessionPayload;
  idToken: string;
}) {
  const workflow = await loadWorkflowConfig(options.module, options.idToken);
  return {
    workflow,
    writes: createApprovalWrites({
      documentType: options.documentType,
      documentId: options.documentId,
      documentNumber: options.documentNumber,
      requestedBy: options.requestedBy,
      steps: workflow.steps,
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
  module: ProcurementWorkflowModule;
}) {
  const workflow = await loadWorkflowConfig(options.module, options.idToken);
  const approvals = await loadApprovals(options.documentId, options.idToken);
  const requestedBy = text(approvals[0]?.requestedBy);
  return applyApprovalAction({
    approvals,
    action: options.action,
    comment: options.comment,
    session: options.session,
    allowSelfApproval: workflow.allowSelfApproval,
    requestedBy,
  });
}

export async function createMaterialRequirement(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "purchaseRequisition:create");
  const data = parseOrFail(materialRequirementSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireRecord("plants", data.plantId, options.idToken, "Plant");
  const id = crypto.randomUUID();
  const numbered = await issueProcurementNumber("REQ", options.session, options.idToken);
  const record = {
    requirementId: id,
    requirementNumber: numbered.documentNumber,
    requestedBy: options.session.uid,
    departmentId: data.departmentId || "",
    plantId: data.plantId,
    requiredDate: data.requiredDate,
    priority: data.priority,
    purpose: data.purpose,
    source: data.source,
    status: "draft",
    remarks: data.remarks || "",
    searchIndex: searchIndex(numbered.documentNumber, data.purpose, data.source),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(PROCUREMENT_COLLECTIONS.requirements, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditProcurement(options.idToken, options.session, {
    action: "CREATE",
    resource: PROCUREMENT_COLLECTIONS.requirements,
    resourceId: id,
    description: `Created material requirement ${numbered.documentNumber}.`,
    newData: { requirementNumber: numbered.documentNumber, source: data.source },
  });
  return { id, record };
}

export async function createPurchaseRequisition(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
  id?: string;
}) {
  ensurePermission(options.session, options.id ? "purchaseRequisition:update" : "purchaseRequisition:create");
  const data = parseOrFail(purchaseRequisitionSchema, options.payload);
  const existing = options.id
    ? await requireRecord(PROCUREMENT_COLLECTIONS.requisitions, options.id, options.idToken, "Purchase requisition")
    : null;
  if (existing && text(existing.status) !== "draft" && text(existing.status) !== "rejected") {
    fail("Only draft or rejected requisitions can be edited.");
  }
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireRecord("plants", data.plantId, options.idToken, "Plant");
  for (const item of data.items) {
    await requireEligibleMaterial(item.materialId, options.idToken);
  }
  const id = options.id || crypto.randomUUID();
  const numbered = existing
    ? { documentNumber: text(existing.requisitionNumber) }
    : await issueProcurementNumber("PR", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  if (existing) {
    const previous = await listByField(PROCUREMENT_COLLECTIONS.requisitionItems, "requisitionId", id, options.idToken);
    for (const row of previous) {
      writes.push(writeOf(PROCUREMENT_COLLECTIONS.requisitionItems, String(row.id), { ...row, status: "superseded", updatedBy: options.session.uid, updatedAt: new Date().toISOString() }));
    }
  }
  const items = [];
  for (const item of data.items) {
    const material = (await requireEligibleMaterial(item.materialId, options.idToken)).material;
    const itemId = crypto.randomUUID();
    const record = {
      requisitionItemId: itemId,
      requisitionId: id,
      ...item,
      description: item.description || materialLabel(material),
      uom: item.uom || text(material?.uom),
      searchIndex: searchIndex(item.materialId, item.description),
      ...actorStamp(options.session),
    };
    items.push(record);
    writes.push(writeOf(PROCUREMENT_COLLECTIONS.requisitionItems, itemId, record, { exists: false }));
  }
  if (data.requirementId) {
    const requirement = await requireRecord(PROCUREMENT_COLLECTIONS.requirements, data.requirementId, options.idToken, "Material requirement");
    writes.push(
      writeOf(PROCUREMENT_COLLECTIONS.requirements, data.requirementId, {
        ...requirement,
        status: "converted",
        requisitionId: id,
        updatedBy: options.session.uid,
        updatedAt: new Date().toISOString(),
      })
    );
  }
  const record = {
    requisitionId: id,
    requisitionNumber: numbered.documentNumber,
    plantId: data.plantId,
    departmentId: data.departmentId || "",
    requestedBy: existing?.requestedBy || options.session.uid,
    requiredDate: data.requiredDate,
    priority: data.priority,
    purpose: data.purpose,
    requirementId: data.requirementId || "",
    status: "draft",
    approvalStatus: "not_started",
    remarks: data.remarks || "",
    itemCount: items.length,
    searchIndex: searchIndex(numbered.documentNumber, data.purpose, data.departmentId),
    ...actorStamp(options.session, existing || undefined),
  };
  writes.push(
    writeOf(PROCUREMENT_COLLECTIONS.requisitions, id, record, {
      updateTime: existing?._updateTime ? String(existing._updateTime) : undefined,
      exists: existing ? undefined : false,
    })
  );
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditProcurement(options.idToken, options.session, {
    action: existing ? "PR_UPDATED" : "PR_CREATED",
    resource: PROCUREMENT_COLLECTIONS.requisitions,
    resourceId: id,
    description: `${existing ? "Updated" : "Created"} purchase requisition ${numbered.documentNumber}.`,
    newData: { requisitionNumber: numbered.documentNumber, status: "draft" },
  });
  return { id, record, items };
}

export async function submitPurchaseRequisition(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  ensurePermission(options.session, "purchaseRequisition:submit");
  const record = await requireRecord(PROCUREMENT_COLLECTIONS.requisitions, options.id, options.idToken, "Purchase requisition");
  const from = text(record.status);
  if (!canTransition(PR_TRANSITIONS, from, "submitted")) workflowFail(from, "submit");
  const { writes: approvalWrites } = await startApprovals({
    module: WORKFLOW_MODULES.purchaseRequisition,
    documentType: "purchaseRequisition",
    documentId: options.id,
    documentNumber: text(record.requisitionNumber),
    requestedBy: text(record.requestedBy),
    session: options.session,
    idToken: options.idToken,
  });
  const next = {
    ...record,
    status: "department_review",
    approvalStatus: "pending",
    submittedBy: options.session.uid,
    submittedAt: new Date().toISOString(),
    ...actorStamp(options.session, record),
  };
  await commitWrites(
    [writeOf(PROCUREMENT_COLLECTIONS.requisitions, options.id, next), ...approvalWrites],
    options.idToken
  );
  await auditProcurement(options.idToken, options.session, {
    action: "PR_SUBMITTED",
    resource: PROCUREMENT_COLLECTIONS.requisitions,
    resourceId: options.id,
    description: `Submitted purchase requisition ${text(record.requisitionNumber)}.`,
    oldData: { status: from },
    newData: { status: next.status },
    reason: options.reason,
  });
  await notifyProcurement(options.idToken, options.session, {
    type: "pr_submitted",
    title: "PR submitted",
    message: `${text(record.requisitionNumber)} is waiting for department approval.`,
    resource: PROCUREMENT_COLLECTIONS.requisitions,
    resourceId: options.id,
    audienceRoles: ["department_head", "purchase"],
  });
  return { id: options.id, record: next };
}

export async function actOnPurchaseRequisition(options: {
  id: string;
  action: "approve" | "reject" | "return" | "cancel" | "review";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const record = await requireRecord(PROCUREMENT_COLLECTIONS.requisitions, options.id, options.idToken, "Purchase requisition");
  if (options.action === "cancel") {
    ensurePermission(options.session, "purchaseRequisition:cancel");
    if (!canTransition(PR_TRANSITIONS, text(record.status), "cancelled")) workflowFail(text(record.status), "cancel");
    if (!text(options.comment)) fail("A cancellation reason is required.");
    const next = { ...record, status: "cancelled", approvalStatus: "cancelled", cancelReason: options.comment, ...actorStamp(options.session, record) };
    await commitWrites([writeOf(PROCUREMENT_COLLECTIONS.requisitions, options.id, next)], options.idToken);
    await auditProcurement(options.idToken, options.session, {
      action: "PR_CANCELLED",
      resource: PROCUREMENT_COLLECTIONS.requisitions,
      resourceId: options.id,
      description: `Cancelled purchase requisition ${text(record.requisitionNumber)}.`,
      oldData: { status: record.status },
      newData: { status: "cancelled" },
      reason: options.comment,
    });
    return { id: options.id, record: next };
  }
  if (options.action === "review") {
    ensurePermission(options.session, "purchaseRequisition:update");
    if (text(record.status) !== "approved") workflowFail(text(record.status), "review");
    const next = { ...record, status: "purchase_review", ...actorStamp(options.session, record) };
    await commitWrites([writeOf(PROCUREMENT_COLLECTIONS.requisitions, options.id, next)], options.idToken);
    return { id: options.id, record: next };
  }
  ensurePermission(options.session, options.action === "approve" ? "purchaseRequisition:approve" : "purchaseRequisition:reject");
  const result = await handleApproval({
    documentType: "purchaseRequisition",
    documentId: options.id,
    action: options.action,
    comment: options.comment,
    session: options.session,
    idToken: options.idToken,
    module: WORKFLOW_MODULES.purchaseRequisition,
  });
  let status = text(record.status);
  let approvalStatus = text(record.approvalStatus);
  if (result.rejected) {
    status = "rejected";
    approvalStatus = "rejected";
  } else if (result.returned) {
    status = "draft";
    approvalStatus = "returned";
  } else if (result.completed) {
    status = "approved";
    approvalStatus = "approved";
  } else {
    status = "department_review";
    approvalStatus = "pending";
  }
  const next = { ...record, status, approvalStatus, ...actorStamp(options.session, record) };
  await commitWrites([writeOf(PROCUREMENT_COLLECTIONS.requisitions, options.id, next), ...result.writes], options.idToken);
  await auditProcurement(options.idToken, options.session, {
    action: result.rejected ? "PR_REJECTED" : result.returned ? "PR_RETURNED" : "PR_APPROVED",
    resource: PROCUREMENT_COLLECTIONS.requisitions,
    resourceId: options.id,
    description: `PR ${text(record.requisitionNumber)} ${options.action}.`,
    oldData: { status: record.status },
    newData: { status, approvalStatus },
    reason: options.comment,
  });
  await notifyProcurement(options.idToken, options.session, {
    type: result.rejected ? "pr_rejected" : result.completed ? "pr_approved" : "pr_approval_pending",
    title: result.completed ? "PR approved" : result.rejected ? "PR rejected" : "PR approval pending",
    message: `${text(record.requisitionNumber)} is now ${status.replaceAll("_", " ")}.`,
    resource: PROCUREMENT_COLLECTIONS.requisitions,
    resourceId: options.id,
    audienceRoles: ["purchase", "department_head"],
  });
  return { id: options.id, record: next };
}

export async function createRFQ(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
  id?: string;
}) {
  ensurePermission(options.session, options.id ? "rfq:update" : "rfq:create");
  const data = parseOrFail(rfqSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const pr = await requireRecord(PROCUREMENT_COLLECTIONS.requisitions, data.requisitionId, options.idToken, "Purchase requisition");
  if (!["approved", "purchase_review"].includes(text(pr.status))) {
    fail("RFQs can only be created from an approved or purchase-reviewed requisition.");
  }
  const prItems = await listByField(PROCUREMENT_COLLECTIONS.requisitionItems, "requisitionId", data.requisitionId, options.idToken);
  const sourceItems = data.items?.length
    ? data.items
    : prItems.map((item) => ({
        materialId: text(item.materialId),
        quantity: Number(item.requiredQuantity || 0),
        uom: text(item.uom),
        requiredDate: text(item.requiredDate || pr.requiredDate),
        specificationReference: text(item.specificationReference),
        remarks: text(item.remarks),
      }));
  if (!sourceItems.length) fail("RFQ has no material lines.");
  for (const item of sourceItems) await requireEligibleMaterial(item.materialId, options.idToken);
  const materialIds = sourceItems.map((item) => item.materialId);
  for (const vendorId of data.vendorIds) {
    await requireEligibleVendor({ vendorId, materialIds, idToken: options.idToken });
  }
  const existing = options.id
    ? await requireRecord(PROCUREMENT_COLLECTIONS.rfqs, options.id, options.idToken, "RFQ")
    : null;
  if (existing && text(existing.status) !== "draft") fail("Only draft RFQs can be edited.");
  const id = options.id || crypto.randomUUID();
  const numbered = existing
    ? { documentNumber: text(existing.rfqNumber) }
    : await issueProcurementNumber("RFQ", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const items = [];
  for (const item of sourceItems) {
    const itemId = crypto.randomUUID();
    const record = {
      rfqItemId: itemId,
      rfqId: id,
      ...item,
      searchIndex: searchIndex(item.materialId),
      ...actorStamp(options.session),
    };
    items.push(record);
    writes.push(writeOf(PROCUREMENT_COLLECTIONS.rfqItems, itemId, record, { exists: false }));
  }
  const vendors = [];
  for (const vendorId of data.vendorIds) {
    const vendorRowId = crypto.randomUUID();
    const vendor = {
      rfqVendorId: vendorRowId,
      rfqId: id,
      vendorId,
      status: "invited",
      responded: false,
      ...actorStamp(options.session),
    };
    vendors.push(vendor);
    writes.push(writeOf(PROCUREMENT_COLLECTIONS.rfqVendors, vendorRowId, vendor, { exists: false }));
  }
  const record = {
    rfqId: id,
    rfqNumber: numbered.documentNumber,
    requisitionId: data.requisitionId,
    plantId: data.plantId || text(pr.plantId),
    issueDate: data.issueDate || "",
    responseDueDate: data.responseDueDate,
    buyer: options.session.uid,
    currency: data.currency || "INR",
    status: "draft",
    remarks: data.remarks || "",
    vendorCount: vendors.length,
    itemCount: items.length,
    responseCount: 0,
    searchIndex: searchIndex(numbered.documentNumber, data.requisitionId),
    ...actorStamp(options.session, existing || undefined),
  };
  writes.push(writeOf(PROCUREMENT_COLLECTIONS.rfqs, id, record, { exists: existing ? undefined : false }));
  writes.push(
    writeOf(PROCUREMENT_COLLECTIONS.requisitions, data.requisitionId, {
      ...pr,
      status: "rfq",
      rfqId: id,
      ...actorStamp(options.session, pr),
    })
  );
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditProcurement(options.idToken, options.session, {
    action: "RFQ_CREATED",
    resource: PROCUREMENT_COLLECTIONS.rfqs,
    resourceId: id,
    description: `Created RFQ ${numbered.documentNumber}.`,
    newData: { rfqNumber: numbered.documentNumber, requisitionId: data.requisitionId },
  });
  return { id, record, items, vendors };
}

export async function transitionRFQ(options: {
  id: string;
  action: "issue" | "close" | "cancel" | "evaluate";
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  const record = await requireRecord(PROCUREMENT_COLLECTIONS.rfqs, options.id, options.idToken, "RFQ");
  const permission: Permission =
    options.action === "issue" ? "rfq:issue" : options.action === "close" ? "rfq:close" : "rfq:update";
  ensurePermission(options.session, permission);
  const nextStatus =
    options.action === "issue"
      ? "issued"
      : options.action === "close"
        ? "closed"
        : options.action === "evaluate"
          ? "evaluation"
          : "cancelled";
  assertTransition(RFQ_TRANSITIONS, text(record.status), nextStatus, options.action);
  if (options.action === "cancel" && !text(options.reason)) fail("A cancellation reason is required.");
  const next = {
    ...record,
    status: nextStatus,
    issueDate: options.action === "issue" ? record.issueDate || new Date().toISOString().slice(0, 10) : record.issueDate,
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(PROCUREMENT_COLLECTIONS.rfqs, options.id, next)], options.idToken);
  await auditProcurement(options.idToken, options.session, {
    action: options.action === "issue" ? "RFQ_ISSUED" : "RFQ_UPDATED",
    resource: PROCUREMENT_COLLECTIONS.rfqs,
    resourceId: options.id,
    description: `RFQ ${text(record.rfqNumber)} ${options.action}.`,
    oldData: { status: record.status },
    newData: { status: nextStatus },
    reason: options.reason,
  });
  if (options.action === "issue") {
    await notifyProcurement(options.idToken, options.session, {
      type: "rfq_issued",
      title: "RFQ issued",
      message: `${text(record.rfqNumber)} was issued to selected vendors.`,
      resource: PROCUREMENT_COLLECTIONS.rfqs,
      resourceId: options.id,
      audienceRoles: ["purchase"],
    });
  }
  return { id: options.id, record: next };
}

export async function recordVendorQuotation(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
  id?: string;
}) {
  ensurePermission(options.session, options.id ? "quotation:update" : "quotation:create");
  const data = parseOrFail(vendorQuotationSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const rfq = await requireRecord(PROCUREMENT_COLLECTIONS.rfqs, data.rfqId, options.idToken, "RFQ");
  if (!["issued", "partially_responded", "fully_responded"].includes(text(rfq.status))) {
    fail("Quotations can only be recorded against an issued RFQ.");
  }
  const invited = await queryMasterDocuments(PROCUREMENT_COLLECTIONS.rfqVendors, options.idToken, {
    filters: [
      { field: "rfqId", value: data.rfqId },
      { field: "vendorId", value: data.vendorId },
    ],
    limit: 5,
  });
  if (!invited.length) fail("This vendor was not invited to the RFQ.");
  const materialIds = data.items.map((item) => item.materialId);
  await requireEligibleVendor({ vendorId: data.vendorId, materialIds, idToken: options.idToken });
  for (const item of data.items) await requireEligibleMaterial(item.materialId, options.idToken);
  const existing = options.id
    ? await requireRecord(PROCUREMENT_COLLECTIONS.quotations, options.id, options.idToken, "Vendor quotation")
    : null;
  if (existing && !["draft", "received"].includes(text(existing.status))) fail("This quotation can no longer be edited.");
  const id = options.id || crypto.randomUUID();
  const numbered = existing
    ? { documentNumber: text(existing.quotationNumber) }
    : await issueProcurementNumber("QUO", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const items = data.items.map((item) => {
    const itemId = crypto.randomUUID();
    const lineTotal = calculateLineTotal({
      quantity: item.quotedQuantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      tax: item.tax,
      freight: item.freight,
      otherCharges: item.otherCharges,
    });
    const record = {
      quotationItemId: itemId,
      quotationId: id,
      rfqId: data.rfqId,
      vendorId: data.vendorId,
      ...item,
      totalPrice: lineTotal,
      lineTotal,
      searchIndex: searchIndex(item.materialId),
      ...actorStamp(options.session),
    };
    writes.push(writeOf(PROCUREMENT_COLLECTIONS.quotationItems, itemId, record, { exists: false }));
    return record;
  });
  const totals = calculateDocumentTotals(
    items.map((item) => ({
      quantity: item.quotedQuantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      tax: item.tax,
      freight: item.freight,
      otherCharges: item.otherCharges,
      lineTotal: item.lineTotal,
    }))
  );
  const record = {
    quotationId: id,
    quotationNumber: numbered.documentNumber,
    rfqId: data.rfqId,
    vendorId: data.vendorId,
    quotationDate: data.quotationDate,
    validUntil: data.validUntil,
    currency: data.currency || text(rfq.currency) || "INR",
    paymentTerms: data.paymentTerms || "",
    deliveryTerms: data.deliveryTerms || "",
    freightTerms: data.freightTerms || "",
    taxTerms: data.taxTerms || "",
    leadTime: data.leadTime || 0,
    remarks: data.remarks || "",
    status: "received",
    ...totals,
    searchIndex: searchIndex(numbered.documentNumber, data.vendorId, data.rfqId),
    ...actorStamp(options.session, existing || undefined),
  };
  writes.push(writeOf(PROCUREMENT_COLLECTIONS.quotations, id, record, { exists: existing ? undefined : false }));
  writes.push(
    writeOf(PROCUREMENT_COLLECTIONS.rfqVendors, String(invited[0].id), {
      ...invited[0],
      responded: true,
      quotationId: id,
      updatedBy: options.session.uid,
      updatedAt: new Date().toISOString(),
    })
  );
  const allVendors = await listByField(PROCUREMENT_COLLECTIONS.rfqVendors, "rfqId", data.rfqId, options.idToken);
  const responseCount = allVendors.filter((row) => row.responded || String(row.id) === String(invited[0].id)).length;
  const rfqStatus = responseCount >= allVendors.length ? "fully_responded" : "partially_responded";
  writes.push(
    writeOf(PROCUREMENT_COLLECTIONS.rfqs, data.rfqId, {
      ...rfq,
      status: rfqStatus,
      responseCount,
      ...actorStamp(options.session, rfq),
    })
  );
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditProcurement(options.idToken, options.session, {
    action: existing ? "QUOTATION_UPDATED" : "QUOTATION_RECEIVED",
    resource: PROCUREMENT_COLLECTIONS.quotations,
    resourceId: id,
    description: `${existing ? "Updated" : "Received"} quotation ${numbered.documentNumber}.`,
    newData: { quotationNumber: numbered.documentNumber, vendorId: data.vendorId, rfqId: data.rfqId },
  });
  await notifyProcurement(options.idToken, options.session, {
    type: "quotation_received",
    title: "Quotation received",
    message: `${numbered.documentNumber} was recorded for ${text(rfq.rfqNumber)}.`,
    resource: PROCUREMENT_COLLECTIONS.quotations,
    resourceId: id,
    audienceRoles: ["purchase"],
  });
  return { id, record, items };
}

export async function transitionQuotation(options: {
  id: string;
  action: "evaluate" | "cancel";
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  ensurePermission(options.session, options.action === "evaluate" ? "quotation:evaluate" : "quotation:update");
  const record = await requireRecord(PROCUREMENT_COLLECTIONS.quotations, options.id, options.idToken, "Vendor quotation");
  const nextStatus = options.action === "evaluate" ? "under_evaluation" : "cancelled";
  assertTransition(QUOTATION_TRANSITIONS, text(record.status), nextStatus, options.action);
  const next = { ...record, status: nextStatus, ...actorStamp(options.session, record) };
  await commitWrites([writeOf(PROCUREMENT_COLLECTIONS.quotations, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function compareQuotations(options: {
  rfqId: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "quotation:evaluate");
  const rfq = await requireRecord(PROCUREMENT_COLLECTIONS.rfqs, options.rfqId, options.idToken, "RFQ");
  const quotations = await listByField(PROCUREMENT_COLLECTIONS.quotations, "rfqId", options.rfqId, options.idToken);
  const usable = quotations.filter((row) => !["cancelled", "expired"].includes(text(row.status)));
  if (usable.length < 1) fail("No quotations are available to compare.");
  const highlights = {
    lowestPrice: usable.reduce((best, row) => (money(row.grandTotal) < money(best.grandTotal) ? row : best), usable[0]),
    shortestLead: usable.reduce((best, row) => (Number(row.leadTime || 9999) < Number(best.leadTime || 9999) ? row : best), usable[0]),
  };
  const id = crypto.randomUUID();
  const record = {
    comparisonId: id,
    rfqId: options.rfqId,
    quotationIds: usable.map((row) => String(row.id)),
    lowestPriceQuotationId: String(highlights.lowestPrice.id),
    shortestLeadQuotationId: String(highlights.shortestLead.id),
    autoSelected: false,
    remarks: "Highlights only. Final vendor selection remains a controlled user action.",
    status: "active",
    ...actorStamp(options.session),
  };
  await commitWrites(
    [
      writeOf(PROCUREMENT_COLLECTIONS.comparisons, id, record, { exists: false }),
      writeOf(PROCUREMENT_COLLECTIONS.rfqs, options.rfqId, {
        ...rfq,
        status: "evaluation",
        ...actorStamp(options.session, rfq),
      }),
    ],
    options.idToken
  );
  return { id, record, highlights: { lowestPrice: highlights.lowestPrice.id, shortestLead: highlights.shortestLead.id } };
}

export async function selectVendor(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "vendorSelection:create");
  const data = parseOrFail(vendorSelectionSchema, options.payload);
  if (!data.selectionReason) fail("A selection reason is required.");
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const quotation = await requireRecord(PROCUREMENT_COLLECTIONS.quotations, data.quotationId, options.idToken, "Vendor quotation");
  if (text(quotation.rfqId) !== data.rfqId) fail("Quotation does not belong to this RFQ.");
  const vendorId = data.vendorId || text(quotation.vendorId);
  const existingSel = await queryMasterDocuments(PROCUREMENT_COLLECTIONS.selections, options.idToken, {
    filters: [{ field: "rfqId", value: data.rfqId }],
    limit: 5,
  });
  if (existingSel.some((row) => !["rejected", "cancelled"].includes(text(row.approvalStatus || row.status)))) {
    fail("A vendor has already been selected for this RFQ.");
  }
  const id = crypto.randomUUID();
  const numbered = await issueProcurementNumber("SEL", options.session, options.idToken);
  const { writes: approvalWrites } = await startApprovals({
    module: WORKFLOW_MODULES.vendorSelection,
    documentType: "vendorSelection",
    documentId: id,
    documentNumber: numbered.documentNumber,
    requestedBy: options.session.uid,
    session: options.session,
    idToken: options.idToken,
  });
  const record = {
    selectionId: id,
    selectionNumber: numbered.documentNumber,
    rfqId: data.rfqId,
    quotationId: data.quotationId,
    vendorId,
    selectedBy: options.session.uid,
    selectedAt: new Date().toISOString(),
    selectionReason: data.selectionReason,
    approvalStatus: "pending",
    status: "submitted",
    remarks: data.remarks || "",
    searchIndex: searchIndex(numbered.documentNumber, data.rfqId, vendorId),
    ...actorStamp(options.session),
  };
  const quotations = await listByField(PROCUREMENT_COLLECTIONS.quotations, "rfqId", data.rfqId, options.idToken);
  const writes: AtomicWrite[] = [
    writeOf(PROCUREMENT_COLLECTIONS.selections, id, record, { exists: false }),
    ...approvalWrites,
    ...quotations.map((row) =>
      writeOf(PROCUREMENT_COLLECTIONS.quotations, String(row.id), {
        ...row,
        status: String(row.id) === data.quotationId ? "selected" : text(row.status) === "cancelled" ? row.status : "not_selected",
        updatedBy: options.session.uid,
        updatedAt: new Date().toISOString(),
      })
    ),
  ];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditProcurement(options.idToken, options.session, {
    action: "VENDOR_SELECTED",
    resource: PROCUREMENT_COLLECTIONS.selections,
    resourceId: id,
    description: `Selected vendor for RFQ ${data.rfqId}.`,
    newData: { vendorId, quotationId: data.quotationId, selectionReason: data.selectionReason },
    reason: data.selectionReason,
  });
  await notifyProcurement(options.idToken, options.session, {
    type: "vendor_selection_pending",
    title: "Vendor selection pending",
    message: `Vendor selection ${numbered.documentNumber} needs approval.`,
    resource: PROCUREMENT_COLLECTIONS.selections,
    resourceId: id,
    audienceRoles: ["department_head", "purchase"],
  });
  return { id, record };
}

export async function actOnVendorSelection(options: {
  id: string;
  action: "approve" | "reject" | "return";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "vendorSelection:approve");
  const record = await requireRecord(PROCUREMENT_COLLECTIONS.selections, options.id, options.idToken, "Vendor selection");
  const result = await handleApproval({
    documentType: "vendorSelection",
    documentId: options.id,
    action: options.action,
    comment: options.comment,
    session: options.session,
    idToken: options.idToken,
    module: WORKFLOW_MODULES.vendorSelection,
  });
  const approvalStatus = result.rejected ? "rejected" : result.returned ? "returned" : result.completed ? "approved" : "pending";
  const next = { ...record, approvalStatus, status: approvalStatus, approvedBy: result.completed ? options.session.uid : "", ...actorStamp(options.session, record) };
  await commitWrites([writeOf(PROCUREMENT_COLLECTIONS.selections, options.id, next), ...result.writes], options.idToken);
  return { id: options.id, record: next };
}

export async function createPurchaseOrder(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
  id?: string;
}) {
  ensurePermission(options.session, options.id ? "purchaseOrder:update" : "purchaseOrder:create");
  const data = parseOrFail(purchaseOrderSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireRecord("plants", data.plantId, options.idToken, "Plant");
  if (data.warehouseId) await requireRecord("warehouses", data.warehouseId, options.idToken, "Warehouse");
  const materialIds = data.items.map((item) => item.materialId);
  await requireEligibleVendor({ vendorId: data.vendorId, materialIds, idToken: options.idToken });
  for (const item of data.items) await requireEligibleMaterial(item.materialId, options.idToken);
  if (data.quotationId) {
    const quotation = await requireRecord(PROCUREMENT_COLLECTIONS.quotations, data.quotationId, options.idToken, "Quotation");
    if (text(quotation.vendorId) !== data.vendorId) fail("PO vendor must match the selected quotation.");
  }
  if (data.selectionId) {
    const selection = await requireRecord(PROCUREMENT_COLLECTIONS.selections, data.selectionId, options.idToken, "Vendor selection");
    if (text(selection.approvalStatus) !== "approved") fail("Vendor selection must be approved before creating a PO.");
  }
  const existing = options.id
    ? await requireRecord(PROCUREMENT_COLLECTIONS.orders, options.id, options.idToken, "Purchase order")
    : null;
  if (existing && text(existing.status) !== "draft") fail("Only draft purchase orders can be edited.");
  const id = options.id || crypto.randomUUID();
  const numbered = existing
    ? { documentNumber: text(existing.poNumber) }
    : await issueProcurementNumber("PO", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const items = data.items.map((item) => {
    const itemId = crypto.randomUUID();
    const lineTotal = calculateLineTotal({
      quantity: item.orderedQuantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      tax: item.tax,
      freight: item.freight,
      otherCharges: item.otherCharges,
    });
    const record = {
      purchaseOrderItemId: itemId,
      purchaseOrderId: id,
      ...item,
      receivedQuantity: 0,
      lineTotal,
      searchIndex: searchIndex(item.materialId),
      ...actorStamp(options.session),
    };
    writes.push(writeOf(PROCUREMENT_COLLECTIONS.orderItems, itemId, record, { exists: false }));
    return record;
  });
  const totals = calculateDocumentTotals(
    items.map((item) => ({
      quantity: item.orderedQuantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      tax: item.tax,
      freight: item.freight,
      otherCharges: item.otherCharges,
      lineTotal: item.lineTotal,
    }))
  );
  const record = {
    purchaseOrderId: id,
    poNumber: numbered.documentNumber,
    vendorId: data.vendorId,
    plantId: data.plantId,
    warehouseId: data.warehouseId || "",
    requisitionId: data.requisitionId || "",
    rfqId: data.rfqId || "",
    quotationId: data.quotationId || "",
    selectionId: data.selectionId || "",
    poDate: data.poDate,
    expectedDeliveryDate: data.expectedDeliveryDate,
    currency: data.currency || "INR",
    paymentTerms: data.paymentTerms || "",
    deliveryTerms: data.deliveryTerms || "",
    freightTerms: data.freightTerms || "",
    taxTerms: data.taxTerms || "",
    buyer: options.session.uid,
    status: "draft",
    approvalStatus: "not_started",
    version: existing?.version || 1,
    overReceiptTolerancePercent: data.overReceiptTolerancePercent ?? DEFAULT_OVER_RECEIPT_TOLERANCE_PERCENT,
    remainingQuantity: items.reduce((sum, item) => sum + money(item.orderedQuantity), 0),
    remarks: data.remarks || "",
    ...totals,
    searchIndex: searchIndex(numbered.documentNumber, data.vendorId, data.requisitionId),
    ...actorStamp(options.session, existing || undefined),
  };
  writes.push(writeOf(PROCUREMENT_COLLECTIONS.orders, id, record, { exists: existing ? undefined : false }));
  if (data.requisitionId) {
    const pr = await readMasterDocument(PROCUREMENT_COLLECTIONS.requisitions, data.requisitionId, options.idToken);
    if (pr) {
      writes.push(
        writeOf(PROCUREMENT_COLLECTIONS.requisitions, data.requisitionId, {
          ...pr,
          status: "po",
          purchaseOrderId: id,
          ...actorStamp(options.session, pr),
        })
      );
    }
  }
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditProcurement(options.idToken, options.session, {
    action: existing ? "PO_UPDATED" : "PO_CREATED",
    resource: PROCUREMENT_COLLECTIONS.orders,
    resourceId: id,
    description: `${existing ? "Updated" : "Created"} purchase order ${numbered.documentNumber}.`,
    newData: { poNumber: numbered.documentNumber, vendorId: data.vendorId, status: "draft" },
  });
  return { id, record, items };
}

export async function submitPurchaseOrder(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "purchaseOrder:submit");
  const record = await requireRecord(PROCUREMENT_COLLECTIONS.orders, options.id, options.idToken, "Purchase order");
  assertTransition(PO_TRANSITIONS, text(record.status), "submitted", "submit");
  const items = await listByField(PROCUREMENT_COLLECTIONS.orderItems, "purchaseOrderId", options.id, options.idToken);
  await requireEligibleVendor({
    vendorId: text(record.vendorId),
    materialIds: items.map((item) => text(item.materialId)),
    idToken: options.idToken,
  });
  const { writes: approvalWrites } = await startApprovals({
    module: WORKFLOW_MODULES.purchaseOrder,
    documentType: "purchaseOrder",
    documentId: options.id,
    documentNumber: text(record.poNumber),
    requestedBy: text(record.createdBy || options.session.uid),
    session: options.session,
    idToken: options.idToken,
  });
  const next = {
    ...record,
    status: "under_approval",
    approvalStatus: "pending",
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(PROCUREMENT_COLLECTIONS.orders, options.id, next), ...approvalWrites], options.idToken);
  await auditProcurement(options.idToken, options.session, {
    action: "PO_SUBMITTED",
    resource: PROCUREMENT_COLLECTIONS.orders,
    resourceId: options.id,
    description: `Submitted purchase order ${text(record.poNumber)}.`,
    oldData: { status: record.status },
    newData: { status: "under_approval" },
  });
  await notifyProcurement(options.idToken, options.session, {
    type: "po_approval_pending",
    title: "PO approval pending",
    message: `${text(record.poNumber)} is waiting for approval.`,
    resource: PROCUREMENT_COLLECTIONS.orders,
    resourceId: options.id,
    audienceRoles: ["finance", "management", "purchase"],
  });
  return { id: options.id, record: next };
}

export async function actOnPurchaseOrder(options: {
  id: string;
  action: "approve" | "reject" | "return" | "send" | "acknowledge" | "cancel" | "close";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const record = await requireRecord(PROCUREMENT_COLLECTIONS.orders, options.id, options.idToken, "Purchase order");
  if (options.action === "cancel") {
    ensurePermission(options.session, "purchaseOrder:cancel");
    if (!canTransition(PO_TRANSITIONS, text(record.status), "cancelled")) workflowFail(text(record.status), "cancel");
    if (!text(options.comment)) fail("A cancellation reason is required.");
    const next = {
      ...record,
      status: "cancelled",
      approvalStatus: "cancelled",
      cancelReason: options.comment,
      cancelledBy: options.session.uid,
      cancelledAt: new Date().toISOString(),
      ...actorStamp(options.session, record),
    };
    await commitWrites([writeOf(PROCUREMENT_COLLECTIONS.orders, options.id, next)], options.idToken);
    await auditProcurement(options.idToken, options.session, {
      action: "PO_CANCELLED",
      resource: PROCUREMENT_COLLECTIONS.orders,
      resourceId: options.id,
      description: `Cancelled purchase order ${text(record.poNumber)}.`,
      oldData: { status: record.status },
      newData: { status: "cancelled" },
      reason: options.comment,
    });
    return { id: options.id, record: next };
  }
  if (options.action === "send" || options.action === "acknowledge" || options.action === "close") {
    ensurePermission(options.session, "purchaseOrder:update");
    const nextStatus = options.action === "send" ? "sent" : options.action === "acknowledge" ? "acknowledged" : "closed";
    assertTransition(PO_TRANSITIONS, text(record.status), nextStatus, options.action);
    const next = { ...record, status: nextStatus, ...actorStamp(options.session, record) };
    await commitWrites([writeOf(PROCUREMENT_COLLECTIONS.orders, options.id, next)], options.idToken);
    await auditProcurement(options.idToken, options.session, {
      action: options.action === "send" ? "PO_SENT" : "PO_UPDATED",
      resource: PROCUREMENT_COLLECTIONS.orders,
      resourceId: options.id,
      description: `Purchase order ${text(record.poNumber)} ${options.action}.`,
      oldData: { status: record.status },
      newData: { status: nextStatus },
    });
    if (options.action === "send") {
      await notifyProcurement(options.idToken, options.session, {
        type: "po_sent",
        title: "PO sent",
        message: `${text(record.poNumber)} was sent to the vendor.`,
        resource: PROCUREMENT_COLLECTIONS.orders,
        resourceId: options.id,
        audienceRoles: ["purchase", "warehouse"],
      });
    }
    return { id: options.id, record: next };
  }
  ensurePermission(options.session, options.action === "approve" ? "purchaseOrder:approve" : "purchaseOrder:reject");
  const result = await handleApproval({
    documentType: "purchaseOrder",
    documentId: options.id,
    action: options.action,
    comment: options.comment,
    session: options.session,
    idToken: options.idToken,
    module: WORKFLOW_MODULES.purchaseOrder,
  });
  const status = result.rejected ? "draft" : result.returned ? "draft" : result.completed ? "approved" : "under_approval";
  const approvalStatus = result.rejected ? "rejected" : result.returned ? "returned" : result.completed ? "approved" : "pending";
  const next = { ...record, status, approvalStatus, ...actorStamp(options.session, record) };
  await commitWrites([writeOf(PROCUREMENT_COLLECTIONS.orders, options.id, next), ...result.writes], options.idToken);
  await auditProcurement(options.idToken, options.session, {
    action: result.completed ? "PO_APPROVED" : result.rejected ? "PO_REJECTED" : "PO_UPDATED",
    resource: PROCUREMENT_COLLECTIONS.orders,
    resourceId: options.id,
    description: `Purchase order ${text(record.poNumber)} ${options.action}.`,
    oldData: { status: record.status },
    newData: { status, approvalStatus },
    reason: options.comment,
  });
  await notifyProcurement(options.idToken, options.session, {
    type: result.completed ? "po_approved" : result.rejected ? "po_rejected" : "po_approval_pending",
    title: result.completed ? "PO approved" : result.rejected ? "PO rejected" : "PO approval pending",
    message: `${text(record.poNumber)} is now ${status.replaceAll("_", " ")}.`,
    resource: PROCUREMENT_COLLECTIONS.orders,
    resourceId: options.id,
    audienceRoles: ["purchase", "finance", "management"],
  });
  return { id: options.id, record: next };
}

export async function createPurchaseOrderAmendment(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "purchaseOrderAmendment:create");
  const data = parseOrFail(purchaseOrderAmendmentSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const order = await requireRecord(PROCUREMENT_COLLECTIONS.orders, data.purchaseOrderId, options.idToken, "Purchase order");
  if (!["approved", "sent", "acknowledged", "partially_received"].includes(text(order.status))) {
    fail("Only issued purchase orders can be amended. Draft POs can be edited directly.");
  }
  const currentItems = await listByField(PROCUREMENT_COLLECTIONS.orderItems, "purchaseOrderId", data.purchaseOrderId, options.idToken);
  const previousValues = {
    expectedDeliveryDate: order.expectedDeliveryDate,
    paymentTerms: order.paymentTerms,
    deliveryTerms: order.deliveryTerms,
    overReceiptTolerancePercent: order.overReceiptTolerancePercent,
    items: currentItems.map((item) => ({
      materialId: item.materialId,
      orderedQuantity: item.orderedQuantity,
      unitPrice: item.unitPrice,
    })),
  };
  const newValues = {
    expectedDeliveryDate: data.expectedDeliveryDate || order.expectedDeliveryDate,
    paymentTerms: data.paymentTerms || order.paymentTerms,
    deliveryTerms: data.deliveryTerms || order.deliveryTerms,
    overReceiptTolerancePercent: data.overReceiptTolerancePercent ?? order.overReceiptTolerancePercent,
    items: data.items || previousValues.items,
  };
  const id = crypto.randomUUID();
  const numbered = await issueProcurementNumber("AMD", options.session, options.idToken);
  const version = Number(order.version || 1) + 1;
  const { writes: approvalWrites } = await startApprovals({
    module: WORKFLOW_MODULES.purchaseOrderAmendment,
    documentType: "purchaseOrderAmendment",
    documentId: id,
    documentNumber: numbered.documentNumber,
    requestedBy: options.session.uid,
    session: options.session,
    idToken: options.idToken,
  });
  const record = {
    amendmentId: id,
    purchaseOrderId: data.purchaseOrderId,
    amendmentNumber: numbered.documentNumber,
    version,
    amendmentDate: new Date().toISOString().slice(0, 10),
    reason: data.reason,
    changedFields: Object.keys(newValues),
    previousValues,
    newValues,
    requestedBy: options.session.uid,
    approvedBy: "",
    status: "submitted",
    remarks: data.remarks || "",
    searchIndex: searchIndex(numbered.documentNumber, order.poNumber),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(PROCUREMENT_COLLECTIONS.amendments, id, record, { exists: false }), ...approvalWrites];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditProcurement(options.idToken, options.session, {
    action: "PO_AMENDED",
    resource: PROCUREMENT_COLLECTIONS.amendments,
    resourceId: id,
    description: `Created amendment ${numbered.documentNumber} for ${text(order.poNumber)}.`,
    newData: { amendmentNumber: numbered.documentNumber, version },
    reason: data.reason,
  });
  return { id, record };
}

export async function actOnAmendment(options: {
  id: string;
  action: "approve" | "reject" | "return" | "cancel";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const amendment = await requireRecord(PROCUREMENT_COLLECTIONS.amendments, options.id, options.idToken, "PO amendment");
  if (options.action === "cancel") {
    ensurePermission(options.session, "purchaseOrderAmendment:create");
    const next = { ...amendment, status: "cancelled", ...actorStamp(options.session, amendment) };
    await commitWrites([writeOf(PROCUREMENT_COLLECTIONS.amendments, options.id, next)], options.idToken);
    return { id: options.id, record: next };
  }
  ensurePermission(options.session, "purchaseOrderAmendment:approve");
  const result = await handleApproval({
    documentType: "purchaseOrderAmendment",
    documentId: options.id,
    action: options.action,
    comment: options.comment,
    session: options.session,
    idToken: options.idToken,
    module: WORKFLOW_MODULES.purchaseOrderAmendment,
  });
  const status = result.rejected ? "rejected" : result.returned ? "draft" : result.completed ? "approved" : "submitted";
  const writes = [...result.writes];
  if (result.completed) {
    const order = await requireRecord(PROCUREMENT_COLLECTIONS.orders, text(amendment.purchaseOrderId), options.idToken, "Purchase order");
    const values = (amendment.newValues || {}) as Record<string, unknown>;
    writes.push(
      writeOf(PROCUREMENT_COLLECTIONS.orders, String(order.id), {
        ...order,
        expectedDeliveryDate: values.expectedDeliveryDate || order.expectedDeliveryDate,
        paymentTerms: values.paymentTerms || order.paymentTerms,
        deliveryTerms: values.deliveryTerms || order.deliveryTerms,
        overReceiptTolerancePercent: values.overReceiptTolerancePercent ?? order.overReceiptTolerancePercent,
        version: amendment.version,
        currentAmendmentId: options.id,
        ...actorStamp(options.session, order),
      })
    );
  }
  const next = {
    ...amendment,
    status,
    approvedBy: result.completed ? options.session.uid : amendment.approvedBy,
    ...actorStamp(options.session, amendment),
  };
  writes.push(writeOf(PROCUREMENT_COLLECTIONS.amendments, options.id, next));
  await commitWrites(writes, options.idToken);
  return { id: options.id, record: next };
}

export async function saveProcurementDocument(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "purchaseOrder:update");
  const data = parseOrFail(procurementDocumentSchema, options.payload);
  const existing = await queryMasterDocuments(PROCUREMENT_COLLECTIONS.documents, options.idToken, {
    filters: [
      { field: "parentId", value: data.parentId },
      { field: "documentType", value: data.documentType },
    ],
    limit: 50,
  });
  const version = Math.max(0, ...existing.map((row) => Number(row.version || 0))) + 1;
  const id = crypto.randomUUID();
  const record = {
    documentId: id,
    ...data,
    version,
    status: "active",
    uploadedBy: options.session.uid,
    uploadedAt: new Date().toISOString(),
    searchIndex: searchIndex(data.title, data.fileName, data.parentId),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(PROCUREMENT_COLLECTIONS.documents, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function markGoodsReceiptLinked(options: {
  purchaseOrderId: string;
  receiptId: string;
  receiptNumber: string;
  session: SessionPayload;
  idToken: string;
  remaining: number;
  nextStatus: string;
}) {
  const order = await readMasterDocument(PROCUREMENT_COLLECTIONS.orders, options.purchaseOrderId, options.idToken);
  await auditProcurement(options.idToken, options.session, {
    action: "GOODS_RECEIPT_LINKED",
    resource: PROCUREMENT_COLLECTIONS.orders,
    resourceId: options.purchaseOrderId,
    description: `Linked goods receipt ${options.receiptNumber} to ${text(order?.poNumber)}.`,
    newData: { receiptId: options.receiptId, status: options.nextStatus, remaining: options.remaining },
  });
  if (order && options.nextStatus === "fully_received" && text(order.requisitionId)) {
    const pr = await readMasterDocument(PROCUREMENT_COLLECTIONS.requisitions, text(order.requisitionId), options.idToken);
    if (pr && text(pr.status) === "po") {
      await commitWrites(
        [
          writeOf(PROCUREMENT_COLLECTIONS.requisitions, String(pr.id), {
            ...pr,
            status: "completed",
            ...actorStamp(options.session, pr),
          }),
        ],
        options.idToken
      );
    }
  }
  if (order && options.nextStatus !== "fully_received" && text(order.expectedDeliveryDate)) {
    const today = new Date().toISOString().slice(0, 10);
    if (text(order.expectedDeliveryDate) < today) {
      await notifyProcurement(options.idToken, options.session, {
        type: "delivery_overdue",
        title: "Overdue delivery received",
        message: `${text(order.poNumber)} was received after the expected delivery date.`,
        resource: PROCUREMENT_COLLECTIONS.orders,
        resourceId: options.purchaseOrderId,
        severity: "warning",
        audienceRoles: ["purchase", "warehouse"],
      });
    }
  }
}

export function vendorPerformanceWriteFromReceipt(options: {
  vendorId: string;
  purchaseOrderId: string;
  receiptId: string;
  expectedDeliveryDate?: string;
  orderedQuantity: number;
  receivedQuantity: number;
  session: SessionPayload;
}) {
  return vendorProcurementEventWrite(options);
}
