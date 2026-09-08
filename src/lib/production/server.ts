import { searchIndex } from "@/lib/inventory/keys";
import { applyApprovalAction, createApprovalWrites, loadApprovals, loadWorkflowConfig, WORKFLOW_MODULES } from "@/lib/production/approvals";
import { nextUniqueBatchNumber, plannedBatchCount } from "@/lib/production/batch-number";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";
import { DEFAULT_BATCH_NUMBER_PATTERN, DEFAULT_YIELD_MAX, DEFAULT_YIELD_MIN } from "@/lib/production/config";
import { checkCustomerEligibility, checkEquipmentEligibility, checkOperatorEligibility, checkProductEligibility } from "@/lib/production/eligibility";
import {
  actorStamp,
  auditProduction,
  commitWrites,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueProductionNumber,
  listByField,
  notifyProduction,
  parseOrFail,
  requireRecord,
  reuseIdempotent,
  text,
  workflowFail,
  writeOf,
} from "@/lib/production/helpers";
import { checkMaterialAvailability, suggestFefoAllocations } from "@/lib/production/availability";
import { checkProductionReadiness } from "@/lib/production/readiness";
import { calculateMaterialRequirements, calculateReconciliation, calculateYield } from "@/lib/production/requirements";
import { BOM_TRANSITIONS, BMR_TRANSITIONS, canTransition, MO_TRANSITIONS, PLAN_TRANSITIONS, SCHEDULE_TRANSITIONS } from "@/lib/production/status";
import { queryMasterDocuments, readMasterDocument, type AtomicWrite } from "@/lib/masters/firestore";
import { DEFAULT_PROCESS_STEPS } from "@/types/production";
import {
  assignmentSchema,
  batchPlanSchema,
  bmrSchema,
  bomSchema,
  deviationSchema,
  dispensingRequestSchema,
  equipmentSchema,
  ipcSchema,
  manufacturingOrderSchema,
  processTemplateSchema,
  productionPlanSchema,
  productionScheduleSchema,
  reconciliationSchema,
  wastageSchema,
  workCenterSchema,
  yieldSchema,
} from "@/lib/validation/production";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";

async function requireEligibleProduct(productId: string, idToken: string) {
  const product = await readMasterDocument("products", productId, idToken);
  const versions = await queryMasterDocuments("productVersions", idToken, {
    filters: [{ field: "productId", value: productId }],
    limit: 20,
  });
  const version = versions.find((row) => ["approved", "active", "effective"].includes(text(row.status))) || versions[0];
  const check = checkProductEligibility({ product, version, requireVersion: versions.length > 0 });
  if (!check.eligible) fail(check.reasons[0] || "Product is not eligible for manufacturing.");
  return { product, version, warnings: check.warnings };
}

async function requireEligibleCustomer(customerId: string | undefined, productId: string, idToken: string) {
  if (!customerId) return null;
  const customer = await readMasterDocument("customers", customerId, idToken);
  const maps = await queryMasterDocuments("productCustomerMappings", idToken, {
    filters: [
      { field: "customerId", value: customerId },
      { field: "productId", value: productId },
    ],
    limit: 5,
  });
  const check = checkCustomerEligibility({ customer, mapping: maps[0] || null, requireMapping: true });
  if (!check.eligible) fail(check.reasons[0] || "Customer is not eligible for this product.");
  return customer;
}

async function loadEffectiveBom(productId: string, idToken: string, asOf = new Date().toISOString().slice(0, 10)) {
  const rows = await queryMasterDocuments(PRODUCTION_COLLECTIONS.boms, idToken, {
    filters: [{ field: "productId", value: productId }],
    limit: 50,
  });
  const effective = rows
    .filter((row) => ["approved", "effective"].includes(text(row.status)))
    .filter((row) => text(row.effectiveDate) <= asOf && (!text(row.expiryDate) || text(row.expiryDate) >= asOf))
    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
  return effective[0] || null;
}

async function startApprovals(options: {
  module: string;
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

export async function createProductionPlan(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string; id?: string }) {
  ensurePermission(options.session, options.id ? "productionPlan:update" : "productionPlan:create");
  const data = parseOrFail(productionPlanSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireRecord("plants", data.plantId, options.idToken, "Plant");
  for (const item of data.items) {
    await requireEligibleProduct(item.productId, options.idToken);
    if (item.customerId) await requireEligibleCustomer(item.customerId, item.productId, options.idToken);
  }
  const existing = options.id ? await requireRecord(PRODUCTION_COLLECTIONS.plans, options.id, options.idToken, "Production plan") : null;
  if (existing && !["draft"].includes(text(existing.status))) fail("Only draft plans can be edited.");
  const id = options.id || crypto.randomUUID();
  const numbered = existing ? { documentNumber: text(existing.planNumber) } : await issueProductionNumber("PLN", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const items = data.items.map((item) => {
    const itemId = crypto.randomUUID();
    const record = { planItemId: itemId, productionPlanId: id, ...item, ...actorStamp(options.session) };
    writes.push(writeOf(PRODUCTION_COLLECTIONS.planItems, itemId, record, { exists: false }));
    return record;
  });
  const record = {
    productionPlanId: id,
    planNumber: numbered.documentNumber,
    plantId: data.plantId,
    departmentId: data.departmentId || "",
    productionPeriod: data.productionPeriod,
    priority: data.priority,
    customerId: data.customerId || data.items[0]?.customerId || "",
    productId: data.productId || data.items[0]?.productId || "",
    plannedQuantity: data.plannedQuantity || data.items.reduce((sum, item) => sum + Number(item.quantity), 0),
    uom: data.uom || data.items[0]?.uom || "",
    targetDate: data.targetDate,
    requestedDate: data.requestedDate || "",
    status: "draft",
    planningNotes: data.planningNotes || "",
    itemCount: items.length,
    searchIndex: searchIndex(numbered.documentNumber, data.productionPeriod, data.customerId),
    ...actorStamp(options.session, existing || undefined),
  };
  writes.push(writeOf(PRODUCTION_COLLECTIONS.plans, id, record, { exists: existing ? undefined : false }));
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditProduction(options.idToken, options.session, {
    action: "PLAN_CREATED",
    resource: PRODUCTION_COLLECTIONS.plans,
    resourceId: id,
    description: `Created production plan ${numbered.documentNumber}.`,
    newData: { planNumber: numbered.documentNumber },
  });
  return { id, record, items };
}

export async function actOnProductionPlan(options: {
  id: string;
  action: "submit" | "approve" | "reject" | "return" | "cancel";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const record = await requireRecord(PRODUCTION_COLLECTIONS.plans, options.id, options.idToken, "Production plan");
  if (options.action === "submit") {
    ensurePermission(options.session, "productionPlan:submit");
    if (!canTransition(PLAN_TRANSITIONS, text(record.status), "submitted")) workflowFail(text(record.status), "submit");
    const { writes } = await startApprovals({
      module: WORKFLOW_MODULES.productionPlan,
      documentType: "productionPlan",
      documentId: options.id,
      documentNumber: text(record.planNumber),
      requestedBy: text(record.createdBy),
      session: options.session,
      idToken: options.idToken,
    });
    const next = { ...record, status: "under_review", ...actorStamp(options.session, record) };
    await commitWrites([writeOf(PRODUCTION_COLLECTIONS.plans, options.id, next), ...writes], options.idToken);
    await auditProduction(options.idToken, options.session, {
      action: "PLAN_SUBMITTED",
      resource: PRODUCTION_COLLECTIONS.plans,
      resourceId: options.id,
      description: `Submitted production plan ${text(record.planNumber)}.`,
      oldData: { status: record.status },
      newData: { status: "under_review" },
    });
    await notifyProduction(options.idToken, options.session, {
      type: "production_plan_approval",
      title: "Production plan approval",
      message: `${text(record.planNumber)} is waiting for approval.`,
      resource: PRODUCTION_COLLECTIONS.plans,
      resourceId: options.id,
      audienceRoles: ["department_head", "production"],
    });
    return { id: options.id, record: next };
  }
  if (options.action === "cancel") {
    ensurePermission(options.session, "productionPlan:cancel");
    if (!canTransition(PLAN_TRANSITIONS, text(record.status), "cancelled")) workflowFail(text(record.status), "cancel");
    const next = { ...record, status: "cancelled", cancelReason: options.comment || "", ...actorStamp(options.session, record) };
    await commitWrites([writeOf(PRODUCTION_COLLECTIONS.plans, options.id, next)], options.idToken);
    return { id: options.id, record: next };
  }
  ensurePermission(options.session, options.action === "approve" ? "productionPlan:approve" : "productionPlan:update");
  const approvals = await loadApprovals("productionPlan", options.id, options.idToken);
  const workflow = await loadWorkflowConfig(WORKFLOW_MODULES.productionPlan, options.idToken);
  const result = applyApprovalAction({
    documentType: "productionPlan",
    approvals,
    action: options.action === "return" ? "return" : options.action,
    comment: options.comment,
    session: options.session,
    allowSelfApproval: workflow.allowSelfApproval,
    requestedBy: text(record.createdBy),
  });
  const status = result.rejected || result.returned ? "draft" : result.completed ? "approved" : "under_review";
  const next = { ...record, status, ...actorStamp(options.session, record) };
  await commitWrites([writeOf(PRODUCTION_COLLECTIONS.plans, options.id, next), ...result.writes], options.idToken);
  await auditProduction(options.idToken, options.session, {
    action: result.completed ? "PLAN_APPROVED" : "PLAN_UPDATED",
    resource: PRODUCTION_COLLECTIONS.plans,
    resourceId: options.id,
    description: `Production plan ${text(record.planNumber)} ${options.action}.`,
    oldData: { status: record.status },
    newData: { status },
    reason: options.comment,
  });
  return { id: options.id, record: next };
}

export async function createProductionSchedule(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "productionSchedule:create");
  const data = parseOrFail(productionScheduleSchema, options.payload);
  if (data.plannedEndDate < data.plannedStartDate) fail("Planned end cannot be before planned start.");
  await requireEligibleProduct(data.productId, options.idToken);
  if (data.workCenterId) await requireRecord(PRODUCTION_COLLECTIONS.workCenters, data.workCenterId, options.idToken, "Work center");
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const numbered = await issueProductionNumber("SCH", options.session, options.idToken);
  const record = {
    scheduleId: id,
    scheduleNumber: numbered.documentNumber,
    ...data,
    status: "planned",
    actualStartDate: "",
    actualEndDate: "",
    searchIndex: searchIndex(numbered.documentNumber, data.productId),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(PRODUCTION_COLLECTIONS.schedules, id, record, { exists: false })];
  if (data.productionPlanId) {
    const plan = await readMasterDocument(PRODUCTION_COLLECTIONS.plans, data.productionPlanId, options.idToken);
    if (plan && text(plan.status) === "approved") {
      writes.push(writeOf(PRODUCTION_COLLECTIONS.plans, data.productionPlanId, { ...plan, status: "scheduled", ...actorStamp(options.session, plan) }));
    }
  }
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditProduction(options.idToken, options.session, {
    action: "SCHEDULE_CREATED",
    resource: PRODUCTION_COLLECTIONS.schedules,
    resourceId: id,
    description: `Created schedule ${numbered.documentNumber}.`,
    newData: { scheduleNumber: numbered.documentNumber },
  });
  return { id, record };
}

export async function transitionSchedule(options: { id: string; action: "schedule" | "ready" | "start" | "pause" | "complete" | "cancel"; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "productionSchedule:update");
  const record = await requireRecord(PRODUCTION_COLLECTIONS.schedules, options.id, options.idToken, "Schedule");
  const nextStatus =
    options.action === "schedule"
      ? "scheduled"
      : options.action === "ready"
        ? "ready"
        : options.action === "start"
          ? "in_progress"
          : options.action === "pause"
            ? "paused"
            : options.action === "complete"
              ? "completed"
              : "cancelled";
  if (!canTransition(SCHEDULE_TRANSITIONS, text(record.status), nextStatus)) workflowFail(text(record.status), options.action);
  const next = {
    ...record,
    status: nextStatus,
    actualStartDate: options.action === "start" ? new Date().toISOString() : record.actualStartDate,
    actualEndDate: options.action === "complete" ? new Date().toISOString() : record.actualEndDate,
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(PRODUCTION_COLLECTIONS.schedules, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function createBatchPlan(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "batchPlan:create");
  const data = parseOrFail(batchPlanSchema, options.payload);
  await requireEligibleProduct(data.productId, options.idToken);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const plannedBatchCountValue = plannedBatchCount(data.requiredQuantity, data.batchSize, data.roundingRule || "ceil");
  const id = crypto.randomUUID();
  const numbered = await issueProductionNumber("BPL", options.session, options.idToken);
  const record = {
    batchPlanId: id,
    batchPlanNumber: numbered.documentNumber,
    productionPlanId: data.productionPlanId || "",
    productId: data.productId,
    batchSize: data.batchSize,
    uom: data.uom,
    requiredQuantity: data.requiredQuantity,
    plannedBatchCount: plannedBatchCountValue,
    targetYield: data.targetYield || "",
    manufacturingSite: data.manufacturingSite || "",
    plannedStart: data.plannedStart || "",
    plannedEnd: data.plannedEnd || "",
    roundingRule: data.roundingRule || "ceil",
    status: "planned",
    remarks: data.remarks || "",
    searchIndex: searchIndex(numbered.documentNumber, data.productId),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(PRODUCTION_COLLECTIONS.batchPlans, id, record, { exists: false })], options.idToken);
  await auditProduction(options.idToken, options.session, {
    action: "BATCH_PLAN_CREATED",
    resource: PRODUCTION_COLLECTIONS.batchPlans,
    resourceId: id,
    description: `Planned ${plannedBatchCountValue} batches for product ${data.productId}.`,
    newData: { plannedBatchCount: plannedBatchCountValue },
  });
  return { id, record };
}

export async function createBom(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "bom:create");
  const data = parseOrFail(bomSchema, options.payload);
  await requireEligibleProduct(data.productId, options.idToken);
  for (const item of data.items) await requireRecord("materials", item.materialId, options.idToken, "Material");
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const previous = await queryMasterDocuments(PRODUCTION_COLLECTIONS.boms, options.idToken, {
    filters: [{ field: "productId", value: data.productId }],
    limit: 50,
  });
  const version = Math.max(0, ...previous.map((row) => Number(row.version || 0))) + 1;
  const id = crypto.randomUUID();
  const numbered = await issueProductionNumber("BOM", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const items = data.items.map((item, index) => {
    const itemId = crypto.randomUUID();
    const record = { bomItemId: itemId, bomId: id, sequence: item.sequence || index + 1, ...item, ...actorStamp(options.session) };
    writes.push(writeOf(PRODUCTION_COLLECTIONS.bomItems, itemId, record, { exists: false }));
    return record;
  });
  const record = {
    bomId: id,
    bomNumber: numbered.documentNumber,
    productId: data.productId,
    version,
    effectiveDate: data.effectiveDate,
    expiryDate: data.expiryDate || "",
    batchSize: data.batchSize,
    uom: data.uom,
    status: "draft",
    approvedBy: "",
    approvedAt: "",
    processSteps: data.processSteps?.length ? data.processSteps : [...DEFAULT_PROCESS_STEPS],
    remarks: data.remarks || "",
    searchIndex: searchIndex(numbered.documentNumber, data.productId, String(version)),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(PRODUCTION_COLLECTIONS.boms, id, record, { exists: false }));
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditProduction(options.idToken, options.session, {
    action: version === 1 ? "BOM_CREATED" : "BOM_VERSION_CREATED",
    resource: PRODUCTION_COLLECTIONS.boms,
    resourceId: id,
    description: `Created BOM ${numbered.documentNumber} version ${version}.`,
    newData: { version, productId: data.productId },
  });
  return { id, record, items };
}

export async function actOnBom(options: { id: string; action: "submit" | "approve" | "reject" | "return" | "activate"; comment?: string; session: SessionPayload; idToken: string }) {
  const record = await requireRecord(PRODUCTION_COLLECTIONS.boms, options.id, options.idToken, "BOM");
  if (["effective", "superseded", "obsolete"].includes(text(record.status)) && options.action !== "activate") {
    fail("Approved historical BOM versions cannot be edited.");
  }
  if (options.action === "submit") {
    ensurePermission(options.session, "bom:submit");
    if (!canTransition(BOM_TRANSITIONS, text(record.status), "under_review")) workflowFail(text(record.status), "submit");
    const { writes } = await startApprovals({
      module: WORKFLOW_MODULES.bom,
      documentType: "bom",
      documentId: options.id,
      documentNumber: text(record.bomNumber),
      requestedBy: text(record.createdBy),
      session: options.session,
      idToken: options.idToken,
    });
    const next = { ...record, status: "under_review", ...actorStamp(options.session, record) };
    await commitWrites([writeOf(PRODUCTION_COLLECTIONS.boms, options.id, next), ...writes], options.idToken);
    return { id: options.id, record: next };
  }
  if (options.action === "activate") {
    ensurePermission(options.session, "bom:approve");
    if (!canTransition(BOM_TRANSITIONS, text(record.status), "effective")) workflowFail(text(record.status), "activate");
    const siblings = await queryMasterDocuments(PRODUCTION_COLLECTIONS.boms, options.idToken, {
      filters: [{ field: "productId", value: text(record.productId) }],
      limit: 50,
    });
    const writes = siblings
      .filter((row) => text(row.status) === "effective" && String(row.id) !== options.id)
      .map((row) => writeOf(PRODUCTION_COLLECTIONS.boms, String(row.id), { ...row, status: "superseded", ...actorStamp(options.session, row) }));
    const next = { ...record, status: "effective", ...actorStamp(options.session, record) };
    await commitWrites([writeOf(PRODUCTION_COLLECTIONS.boms, options.id, next), ...writes], options.idToken);
    await auditProduction(options.idToken, options.session, {
      action: "BOM_APPROVED",
      resource: PRODUCTION_COLLECTIONS.boms,
      resourceId: options.id,
      description: `BOM ${text(record.bomNumber)} is now effective.`,
      newData: { status: "effective", version: record.version },
    });
    return { id: options.id, record: next };
  }
  ensurePermission(options.session, "bom:approve");
  const approvals = await loadApprovals("bom", options.id, options.idToken);
  const workflow = await loadWorkflowConfig(WORKFLOW_MODULES.bom, options.idToken);
  const result = applyApprovalAction({
    documentType: "bom",
    approvals,
    action: options.action === "return" ? "return" : options.action,
    comment: options.comment,
    session: options.session,
    allowSelfApproval: workflow.allowSelfApproval,
    requestedBy: text(record.createdBy),
  });
  const status = result.rejected || result.returned ? "draft" : result.completed ? "approved" : "under_review";
  const next = {
    ...record,
    status,
    approvedBy: result.completed ? options.session.uid : "",
    approvedAt: result.completed ? new Date().toISOString() : "",
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(PRODUCTION_COLLECTIONS.boms, options.id, next), ...result.writes], options.idToken);
  if (result.completed) {
    await auditProduction(options.idToken, options.session, {
      action: "BOM_APPROVED",
      resource: PRODUCTION_COLLECTIONS.boms,
      resourceId: options.id,
      description: `Approved BOM ${text(record.bomNumber)} v${record.version}.`,
      newData: { status: "approved" },
    });
  }
  return { id: options.id, record: next };
}

export async function createManufacturingOrder(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "manufacturingOrder:create");
  const data = parseOrFail(manufacturingOrderSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const { product } = await requireEligibleProduct(data.productId, options.idToken);
  if (data.customerId) await requireEligibleCustomer(data.customerId, data.productId, options.idToken);
  const bom = data.bomId
    ? await requireRecord(PRODUCTION_COLLECTIONS.boms, data.bomId, options.idToken, "BOM")
    : await loadEffectiveBom(data.productId, options.idToken);
  if (!bom) fail("Production cannot start without an effective BOM.");
  if (!["approved", "effective"].includes(text(bom.status))) fail("Linked BOM is not effective.");
  const batch = await nextUniqueBatchNumber({
    productCode: text(product?.productCode || "BATCH"),
    idToken: options.idToken,
    pattern: DEFAULT_BATCH_NUMBER_PATTERN,
  });
  const id = crypto.randomUUID();
  const numbered = await issueProductionNumber("MO", options.session, options.idToken);
  const record = {
    manufacturingOrderId: id,
    manufacturingOrderNumber: numbered.documentNumber,
    productionPlanId: data.productionPlanId || "",
    scheduleId: data.scheduleId || "",
    batchPlanId: data.batchPlanId || "",
    productId: data.productId,
    customerId: data.customerId || "",
    productVersionId: data.productVersionId || "",
    bomId: String(bom.id),
    bomVersion: bom.version,
    processVersion: Array.isArray(bom.processSteps) ? `steps-${(bom.processSteps as unknown[]).length}` : "",
    batchNumber: batch.batchNumber,
    batchNumberDate: new Date().toISOString().slice(0, 10),
    plannedQuantity: data.plannedQuantity,
    batchSize: data.batchSize,
    uom: data.uom,
    plannedStartDate: data.plannedStartDate,
    plannedEndDate: data.plannedEndDate,
    workCenterId: data.workCenterId || "",
    warehouseId: data.warehouseId || "",
    status: "draft",
    priority: data.priority,
    supervisor: data.supervisor || options.session.uid,
    qcStatus: "not_started",
    qaStatus: "not_started",
    remarks: data.remarks || "",
    searchIndex: searchIndex(numbered.documentNumber, batch.batchNumber, data.productId),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(PRODUCTION_COLLECTIONS.orders, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditProduction(options.idToken, options.session, {
    action: "MO_CREATED",
    resource: PRODUCTION_COLLECTIONS.orders,
    resourceId: id,
    description: `Created manufacturing order ${numbered.documentNumber} with batch ${batch.batchNumber}.`,
    newData: { manufacturingOrderNumber: numbered.documentNumber, batchNumber: batch.batchNumber, bomVersion: bom.version },
  });
  await auditProduction(options.idToken, options.session, {
    action: "BATCH_NUMBER_GENERATED",
    resource: PRODUCTION_COLLECTIONS.orders,
    resourceId: id,
    description: `Generated batch number ${batch.batchNumber}.`,
    newData: { batchNumber: batch.batchNumber },
  });
  return { id, record };
}

export async function actOnManufacturingOrder(options: {
  id: string;
  action: "submit" | "approve" | "reject" | "start" | "pause" | "resume" | "complete" | "cancel" | "send_qc";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const record = await requireRecord(PRODUCTION_COLLECTIONS.orders, options.id, options.idToken, "Manufacturing order");
  if (options.action === "submit") {
    ensurePermission(options.session, "manufacturingOrder:update");
    if (!canTransition(MO_TRANSITIONS, text(record.status), "planned")) workflowFail(text(record.status), "submit");
    const { writes } = await startApprovals({
      module: WORKFLOW_MODULES.manufacturingOrder,
      documentType: "manufacturingOrder",
      documentId: options.id,
      documentNumber: text(record.manufacturingOrderNumber),
      requestedBy: text(record.createdBy),
      session: options.session,
      idToken: options.idToken,
    });
    const next = { ...record, status: "planned", ...actorStamp(options.session, record) };
    await commitWrites([writeOf(PRODUCTION_COLLECTIONS.orders, options.id, next), ...writes], options.idToken);
    return { id: options.id, record: next };
  }
  if (options.action === "approve" || options.action === "reject") {
    ensurePermission(options.session, "manufacturingOrder:approve");
    const approvals = await loadApprovals("manufacturingOrder", options.id, options.idToken);
    const workflow = await loadWorkflowConfig(WORKFLOW_MODULES.manufacturingOrder, options.idToken);
    const result = applyApprovalAction({
      documentType: "manufacturingOrder",
      approvals,
      action: options.action,
      comment: options.comment,
      session: options.session,
      allowSelfApproval: workflow.allowSelfApproval,
      requestedBy: text(record.createdBy),
    });
    const status = result.rejected ? "draft" : result.completed ? "approved" : "planned";
    const next = { ...record, status, ...actorStamp(options.session, record) };
    await commitWrites([writeOf(PRODUCTION_COLLECTIONS.orders, options.id, next), ...result.writes], options.idToken);
    if (result.completed) {
      await notifyProduction(options.idToken, options.session, {
        type: "batch_approval",
        title: "Batch approved",
        message: `${text(record.batchNumber)} is approved for manufacturing.`,
        resource: PRODUCTION_COLLECTIONS.orders,
        resourceId: options.id,
        audienceRoles: ["production", "warehouse"],
      });
    }
    return { id: options.id, record: next };
  }
  if (options.action === "start") {
    ensurePermission(options.session, "manufacturingOrder:start");
    const readiness = await checkProductionReadiness({ order: record, idToken: options.idToken });
    if (!readiness.ready) fail(readiness.blockers[0] || "Production is not ready to start.");
    const next = { ...record, status: "manufacturing", actualStartDate: new Date().toISOString(), ...actorStamp(options.session, record) };
    await commitWrites([writeOf(PRODUCTION_COLLECTIONS.orders, options.id, next)], options.idToken);
    await auditProduction(options.idToken, options.session, {
      action: "MANUFACTURING_STARTED",
      resource: PRODUCTION_COLLECTIONS.orders,
      resourceId: options.id,
      description: `Started manufacturing ${text(record.batchNumber)}.`,
      oldData: { status: record.status },
      newData: { status: "manufacturing" },
    });
    await notifyProduction(options.idToken, options.session, {
      type: "production_starting",
      title: "Production starting",
      message: `Batch ${text(record.batchNumber)} has started.`,
      resource: PRODUCTION_COLLECTIONS.orders,
      resourceId: options.id,
      audienceRoles: ["production"],
    });
    return { id: options.id, record: next, readiness };
  }
  if (options.action === "pause" || options.action === "resume") {
    ensurePermission(options.session, options.action === "pause" ? "manufacturingOrder:pause" : "manufacturingOrder:start");
    const nextStatus = options.action === "pause" ? "paused" : "manufacturing";
    if (options.action === "pause" && text(record.status) !== "manufacturing" && text(record.status) !== "in_process") {
      workflowFail(text(record.status), "pause");
    }
    const next = { ...record, status: nextStatus, ...actorStamp(options.session, record) };
    await commitWrites([writeOf(PRODUCTION_COLLECTIONS.orders, options.id, next)], options.idToken);
    await auditProduction(options.idToken, options.session, {
      action: options.action === "pause" ? "MANUFACTURING_PAUSED" : "MANUFACTURING_STARTED",
      resource: PRODUCTION_COLLECTIONS.orders,
      resourceId: options.id,
      description: `${options.action} ${text(record.batchNumber)}.`,
      oldData: { status: record.status },
      newData: { status: nextStatus },
    });
    return { id: options.id, record: next };
  }
  if (options.action === "complete" || options.action === "send_qc") {
    ensurePermission(options.session, "manufacturingOrder:complete");
    const steps = await listByField(PRODUCTION_COLLECTIONS.steps, "manufacturingOrderId", options.id, options.idToken);
    const incomplete = steps.filter((row) => !["completed", "skipped"].includes(text(row.status)));
    if (incomplete.length) fail("All required process steps must be completed before manufacturing completion.");
    const yields = await listByField(PRODUCTION_COLLECTIONS.yields, "manufacturingOrderId", options.id, options.idToken);
    if (!yields.length) fail("Yield must be recorded before completion.");
    const recon = await listByField(PRODUCTION_COLLECTIONS.reconciliations, "manufacturingOrderId", options.id, options.idToken);
    if (!recon.length) fail("Material reconciliation must be completed before completion.");
    if (recon.some((row) => text(row.status) === "variance")) fail("Unresolved reconciliation variance must be reviewed.");
    const deviations = await listByField(PRODUCTION_COLLECTIONS.deviations, "manufacturingOrderId", options.id, options.idToken);
    if (deviations.some((row) => text(row.severity) === "critical" && text(row.status) !== "closed")) {
      fail("Unresolved critical deviations block completion.");
    }
    const next = {
      ...record,
      status: "qc_pending",
      qcStatus: "pending",
      qaStatus: "pending",
      actualEndDate: new Date().toISOString(),
      ...actorStamp(options.session, record),
    };
    await commitWrites([writeOf(PRODUCTION_COLLECTIONS.orders, options.id, next)], options.idToken);
    await auditProduction(options.idToken, options.session, {
      action: "MANUFACTURING_COMPLETED",
      resource: PRODUCTION_COLLECTIONS.orders,
      resourceId: options.id,
      description: `Completed manufacturing ${text(record.batchNumber)} and sent to QC pending.`,
      oldData: { status: record.status },
      newData: { status: "qc_pending" },
    });
    await auditProduction(options.idToken, options.session, {
      action: "BATCH_SENT_TO_QC",
      resource: PRODUCTION_COLLECTIONS.orders,
      resourceId: options.id,
      description: `Batch ${text(record.batchNumber)} is QC pending. No QC result was recorded.`,
      newData: { qcStatus: "pending" },
    });
    await notifyProduction(options.idToken, options.session, {
      type: "qc_pending",
      title: "QC pending",
      message: `Batch ${text(record.batchNumber)} is waiting for QC.`,
      resource: PRODUCTION_COLLECTIONS.orders,
      resourceId: options.id,
      audienceRoles: ["qc", "qa", "production"],
    });
    try {
      const { createSampleRequestFromManufacturing } = await import("@/lib/qc/server");
      await createSampleRequestFromManufacturing({
        order: { ...next, id: options.id },
        session: options.session,
        idToken: options.idToken,
      });
    } catch {
      await notifyProduction(options.idToken, options.session, {
        type: "qc_pending",
        title: "QC sample request pending",
        message: `Batch ${text(record.batchNumber)} reached QC Pending. Create the sample request from Quality Control if it was not generated.`,
        resource: PRODUCTION_COLLECTIONS.orders,
        resourceId: options.id,
        audienceRoles: ["qc"],
      });
    }
    return { id: options.id, record: next };
  }
  if (options.action === "cancel") {
    ensurePermission(options.session, "manufacturingOrder:update");
    if (!canTransition(MO_TRANSITIONS, text(record.status), "cancelled") && !["draft", "planned", "approved"].includes(text(record.status))) {
      workflowFail(text(record.status), "cancel");
    }
    const next = { ...record, status: "cancelled", ...actorStamp(options.session, record) };
    await commitWrites([writeOf(PRODUCTION_COLLECTIONS.orders, options.id, next)], options.idToken);
    return { id: options.id, record: next };
  }
  fail("Unknown manufacturing order action.");
}

export async function createDispensingRequest(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "dispensingRequest:create");
  const data = parseOrFail(dispensingRequestSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const order = await requireRecord(PRODUCTION_COLLECTIONS.orders, data.manufacturingOrderId, options.idToken, "Manufacturing order");
  if (!["approved", "ready", "dispensing_pending"].includes(text(order.status))) fail("Dispensing can only be requested for an approved order.");
  await requireRecord("warehouses", data.warehouseId, options.idToken, "Warehouse");
  const bom = await requireRecord(PRODUCTION_COLLECTIONS.boms, text(order.bomId), options.idToken, "BOM");
  const bomItems = await listByField(PRODUCTION_COLLECTIONS.bomItems, "bomId", String(bom.id), options.idToken);
  const required = calculateMaterialRequirements({
    bomBatchSize: Number(bom.batchSize || 0),
    orderBatchSize: Number(order.batchSize || 0),
    items: bomItems.map((item) => ({
      materialId: text(item.materialId),
      quantity: Number(item.quantity || 0),
      uom: text(item.uom),
      wastageAllowance: Number(item.wastageAllowance || 0),
    })),
  });
  const availability = await checkMaterialAvailability(required, options.idToken, { warehouseId: data.warehouseId });
  const id = crypto.randomUUID();
  const numbered = await issueProductionNumber("DSP", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const items = [];
  for (const line of availability) {
    const suggestion = await suggestFefoAllocations(line.materialId, line.requiredQuantity, options.idToken, data.warehouseId);
    const itemId = crypto.randomUUID();
    const record = {
      dispensingItemId: itemId,
      dispensingRequestId: id,
      materialId: line.materialId,
      requiredQuantity: line.requiredQuantity,
      uom: line.uom,
      selectedBatchId: suggestion.allocations[0]?.inventoryBatchId || "",
      selectedBatchNumber: suggestion.allocations[0]?.batchNumber || "",
      warehouseId: data.warehouseId,
      locationId: suggestion.allocations[0]?.locationId || "",
      allocatedQuantity: 0,
      dispensedQuantity: 0,
      shortage: line.shortage,
      status: line.status === "short" ? "short" : "planned",
      ...actorStamp(options.session),
    };
    items.push(record);
    writes.push(writeOf(PRODUCTION_COLLECTIONS.dispensingItems, itemId, record, { exists: false }));
  }
  const record = {
    dispensingRequestId: id,
    dispensingRequestNumber: numbered.documentNumber,
    manufacturingOrderId: data.manufacturingOrderId,
    productId: text(order.productId),
    batchNumber: text(order.batchNumber),
    warehouseId: data.warehouseId,
    requestedBy: options.session.uid,
    requiredDate: data.requiredDate,
    status: "requested",
    remarks: data.remarks || "",
    stockConsumed: false,
    searchIndex: searchIndex(numbered.documentNumber, order.batchNumber),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(PRODUCTION_COLLECTIONS.dispensing, id, record, { exists: false }));
  writes.push(
    writeOf(PRODUCTION_COLLECTIONS.orders, data.manufacturingOrderId, {
      ...order,
      status: "dispensing_pending",
      ...actorStamp(options.session, order),
    })
  );
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditProduction(options.idToken, options.session, {
    action: "DISPENSING_REQUESTED",
    resource: PRODUCTION_COLLECTIONS.dispensing,
    resourceId: id,
    description: `Dispensing requested for ${text(order.batchNumber)}. Stock was not consumed.`,
    newData: { dispensingRequestNumber: numbered.documentNumber },
  });
  if (availability.some((line) => line.status === "short")) {
    await notifyProduction(options.idToken, options.session, {
      type: "material_shortage",
      title: "Material shortage",
      message: `Dispensing ${numbered.documentNumber} has shortages. Procurement is required.`,
      resource: PRODUCTION_COLLECTIONS.dispensing,
      resourceId: id,
      severity: "warning",
      audienceRoles: ["production", "purchase"],
    });
  } else {
    await notifyProduction(options.idToken, options.session, {
      type: "dispensing_pending",
      title: "Dispensing pending",
      message: `${numbered.documentNumber} is ready for warehouse dispensing execution.`,
      resource: PRODUCTION_COLLECTIONS.dispensing,
      resourceId: id,
      audienceRoles: ["warehouse", "production"],
    });
  }
  return { id, record, items, availability };
}

export async function actOnDispensing(options: { id: string; action: "approve" | "cancel"; comment?: string; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "dispensingRequest:approve");
  const record = await requireRecord(PRODUCTION_COLLECTIONS.dispensing, options.id, options.idToken, "Dispensing request");
  const next = {
    ...record,
    status: options.action === "approve" ? "ready_for_dispensing" : "cancelled",
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(PRODUCTION_COLLECTIONS.dispensing, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function createWorkCenter(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "production:create");
  const data = parseOrFail(workCenterSchema, options.payload);
  await requireRecord("plants", data.plantId, options.idToken, "Plant");
  const id = crypto.randomUUID();
  const record = { workCenterId: id, ...data, searchIndex: searchIndex(data.workCenterCode, data.workCenterName), ...actorStamp(options.session) };
  await commitWrites([writeOf(PRODUCTION_COLLECTIONS.workCenters, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createEquipment(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "production:create");
  const data = parseOrFail(equipmentSchema, options.payload);
  const check = checkEquipmentEligibility({ equipment: data });
  if (!check.eligible) fail(check.reasons[0] || "Equipment is not eligible.");
  const id = crypto.randomUUID();
  const record = { equipmentId: id, ...data, searchIndex: searchIndex(data.equipmentCode, data.equipmentName), ...actorStamp(options.session) };
  await commitWrites([writeOf(PRODUCTION_COLLECTIONS.equipment, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function assignResource(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "manufacturingOrder:update");
  const data = parseOrFail(assignmentSchema, options.payload);
  await requireRecord(PRODUCTION_COLLECTIONS.orders, data.manufacturingOrderId, options.idToken, "Manufacturing order");
  const id = crypto.randomUUID();
  if (data.equipmentId) {
    const equipment = await requireRecord(PRODUCTION_COLLECTIONS.equipment, data.equipmentId, options.idToken, "Equipment");
    const check = checkEquipmentEligibility({ equipment });
    if (!check.eligible) fail(check.reasons[0] || "Equipment is not eligible.");
    const record = { assignmentId: id, manufacturingOrderId: data.manufacturingOrderId, equipmentId: data.equipmentId, ...actorStamp(options.session) };
    await commitWrites([writeOf(PRODUCTION_COLLECTIONS.equipmentAssignments, id, record, { exists: false })], options.idToken);
    return { id, record };
  }
  if (data.userId) {
    const user = await readMasterDocument("users", data.userId, options.idToken);
    if (user) {
      const check = checkOperatorEligibility({ user });
      if (!check.eligible) fail(check.reasons[0] || "Operator is not eligible.");
    }
    const record = {
      assignmentId: id,
      manufacturingOrderId: data.manufacturingOrderId,
      userId: data.userId,
      employeeId: text(user?.employeeId),
      role: data.role || "operator",
      trainingStatus: text(user?.trainingStatus) || "not_recorded",
      assignedAt: new Date().toISOString(),
      ...actorStamp(options.session),
    };
    await commitWrites([writeOf(PRODUCTION_COLLECTIONS.operatorAssignments, id, record, { exists: false })], options.idToken);
    return { id, record };
  }
  fail("Assign either equipment or an operator.");
}

export async function createBmr(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "bmr:create");
  const data = parseOrFail(bmrSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const order = await requireRecord(PRODUCTION_COLLECTIONS.orders, data.manufacturingOrderId, options.idToken, "Manufacturing order");
  const existing = await queryMasterDocuments(PRODUCTION_COLLECTIONS.bmrs, options.idToken, {
    filters: [{ field: "manufacturingOrderId", value: data.manufacturingOrderId }],
    limit: 5,
  });
  if (existing.length) fail("A BMR already exists for this manufacturing order.");
  const bom = text(order.bomId) ? await readMasterDocument(PRODUCTION_COLLECTIONS.boms, text(order.bomId), options.idToken) : null;
  const template = await queryMasterDocuments(PRODUCTION_COLLECTIONS.processTemplates, options.idToken, {
    filters: [{ field: "productId", value: text(order.productId) }],
    limit: 5,
  });
  const stepNames = (Array.isArray(bom?.processSteps) && bom.processSteps.length
    ? (bom.processSteps as string[])
    : template[0] && Array.isArray(template[0].steps)
      ? (template[0].steps as string[])
      : [...DEFAULT_PROCESS_STEPS]);
  const id = crypto.randomUUID();
  const numbered = await issueProductionNumber("BMR", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const steps = stepNames.map((name, index) => {
    const stepId = crypto.randomUUID();
    const record = {
      processStepId: stepId,
      bmrId: id,
      manufacturingOrderId: data.manufacturingOrderId,
      sequence: index + 1,
      stepName: name,
      instructions: "",
      equipment: "",
      operator: "",
      plannedStart: "",
      plannedEnd: "",
      actualStart: "",
      actualEnd: "",
      status: index === 0 ? "ready" : "pending",
      remarks: "",
      ...actorStamp(options.session),
    };
    writes.push(writeOf(PRODUCTION_COLLECTIONS.steps, stepId, record, { exists: false }));
    return record;
  });
  const record = {
    bmrId: id,
    bmrNumber: numbered.documentNumber,
    manufacturingOrderId: data.manufacturingOrderId,
    batchNumber: text(order.batchNumber),
    productId: text(order.productId),
    customerId: text(order.customerId),
    bomVersion: order.bomVersion,
    processVersion: order.processVersion,
    status: "issued",
    startedAt: "",
    completedAt: "",
    supervisor: text(order.supervisor),
    remarks: data.remarks || "",
    searchIndex: searchIndex(numbered.documentNumber, order.batchNumber),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(PRODUCTION_COLLECTIONS.bmrs, id, record, { exists: false }));
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record, steps };
}

export async function actOnBmr(options: { id: string; action: "start" | "pause" | "complete" | "review"; session: SessionPayload; idToken: string }) {
  const record = await requireRecord(PRODUCTION_COLLECTIONS.bmrs, options.id, options.idToken, "BMR");
  const permission: Permission =
    options.action === "review" ? "bmr:review" : options.action === "complete" ? "bmr:complete" : "bmr:execute";
  ensurePermission(options.session, permission);
  const nextStatus =
    options.action === "start" ? "in_progress" : options.action === "pause" ? "paused" : options.action === "complete" ? "completed" : "reviewed";
  if (!canTransition(BMR_TRANSITIONS, text(record.status), nextStatus)) workflowFail(text(record.status), options.action);
  const next = {
    ...record,
    status: nextStatus,
    startedAt: options.action === "start" ? new Date().toISOString() : record.startedAt,
    completedAt: options.action === "complete" ? new Date().toISOString() : record.completedAt,
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(PRODUCTION_COLLECTIONS.bmrs, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function actOnProcessStep(options: {
  id: string;
  action: "start" | "complete" | "skip" | "fail";
  remarks?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "bmr:execute");
  const step = await requireRecord(PRODUCTION_COLLECTIONS.steps, options.id, options.idToken, "Process step");
  const now = new Date().toISOString();
  const nextStatus =
    options.action === "start" ? "in_progress" : options.action === "complete" ? "completed" : options.action === "skip" ? "skipped" : "failed";
  const next = {
    ...step,
    status: nextStatus,
    actualStart: options.action === "start" ? now : step.actualStart,
    actualEnd: ["complete", "skip", "fail"].includes(options.action) ? now : step.actualEnd,
    operator: options.session.uid,
    remarks: options.remarks || step.remarks,
    completedBy: options.action === "complete" ? options.session.uid : step.completedBy,
    completedAt: options.action === "complete" ? now : step.completedAt,
    ...actorStamp(options.session, step),
  };
  await commitWrites([writeOf(PRODUCTION_COLLECTIONS.steps, options.id, next)], options.idToken);
  await auditProduction(options.idToken, options.session, {
    action: "PROCESS_STEP_COMPLETED",
    resource: PRODUCTION_COLLECTIONS.steps,
    resourceId: options.id,
    description: `Process step ${text(step.stepName)} ${options.action}.`,
    oldData: { status: step.status },
    newData: { status: nextStatus },
    reason: options.remarks,
  });
  return { id: options.id, record: next };
}

export async function recordIpc(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "ipc:create");
  const data = parseOrFail(ipcSchema, options.payload);
  await requireRecord(PRODUCTION_COLLECTIONS.bmrs, data.bmrId, options.idToken, "BMR");
  const id = crypto.randomUUID();
  const numbered = await issueProductionNumber("IPC", options.session, options.idToken);
  const record = {
    ipcId: id,
    ipcNumber: numbered.documentNumber,
    ...data,
    checkedBy: options.session.uid,
    checkedAt: new Date().toISOString(),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(PRODUCTION_COLLECTIONS.ipc, id, record, { exists: false })], options.idToken);
  await auditProduction(options.idToken, options.session, {
    action: "IPC_RECORDED",
    resource: PRODUCTION_COLLECTIONS.ipc,
    resourceId: id,
    description: `Recorded IPC ${data.parameter}.`,
    newData: { parameter: data.parameter, result: data.result },
  });
  return { id, record };
}

export async function recordYield(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "yield:create");
  const data = parseOrFail(yieldSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireRecord(PRODUCTION_COLLECTIONS.orders, data.manufacturingOrderId, options.idToken, "Manufacturing order");
  const calc = calculateYield({
    theoreticalQuantity: data.theoreticalQuantity,
    actualQuantity: data.actualQuantity,
    acceptableMin: data.acceptableMin ?? DEFAULT_YIELD_MIN,
    acceptableMax: data.acceptableMax ?? DEFAULT_YIELD_MAX,
  });
  const id = crypto.randomUUID();
  const numbered = await issueProductionNumber("YLD", options.session, options.idToken);
  const record = {
    yieldId: id,
    yieldNumber: numbered.documentNumber,
    manufacturingOrderId: data.manufacturingOrderId,
    bmrId: data.bmrId || "",
    ...calc,
    remarks: data.remarks || "",
    status: "recorded",
    ...actorStamp(options.session),
  };
  const writes = [writeOf(PRODUCTION_COLLECTIONS.yields, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditProduction(options.idToken, options.session, {
    action: "YIELD_RECORDED",
    resource: PRODUCTION_COLLECTIONS.yields,
    resourceId: id,
    description: `Recorded yield ${calc.yieldPercentage}%.`,
    newData: { yieldPercentage: calc.yieldPercentage, result: calc.result },
  });
  if (calc.result !== "within_limit") {
    await notifyProduction(options.idToken, options.session, {
      type: "low_yield",
      title: "Yield outside limit",
      message: `Yield ${calc.yieldPercentage}% is ${calc.result.replaceAll("_", " ")}.`,
      resource: PRODUCTION_COLLECTIONS.yields,
      resourceId: id,
      severity: "warning",
      audienceRoles: ["production", "qa"],
    });
  }
  return { id, record };
}

export async function recordReconciliation(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "reconciliation:create");
  const data = parseOrFail(reconciliationSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const calc = calculateReconciliation({
    issuedQuantity: data.issuedQuantity,
    returnedQuantity: data.returnedQuantity || 0,
    consumedQuantity: data.consumedQuantity,
    wastageQuantity: data.wastageQuantity || 0,
    expectedQuantity: data.expectedQuantity,
  });
  const id = crypto.randomUUID();
  const numbered = await issueProductionNumber("REC", options.session, options.idToken);
  const record = {
    reconciliationId: id,
    reconciliationNumber: numbered.documentNumber,
    manufacturingOrderId: data.manufacturingOrderId,
    bmrId: data.bmrId || "",
    materialId: data.materialId,
    ...calc,
    remarks: data.remarks || "",
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(PRODUCTION_COLLECTIONS.reconciliations, id, record, { exists: false })], options.idToken);
  await auditProduction(options.idToken, options.session, {
    action: "RECONCILIATION_COMPLETED",
    resource: PRODUCTION_COLLECTIONS.reconciliations,
    resourceId: id,
    description: `Reconciliation ${calc.status} for ${data.materialId}.`,
    newData: { status: calc.status, difference: calc.difference },
  });
  if (calc.status === "variance") {
    await notifyProduction(options.idToken, options.session, {
      type: "reconciliation_variance",
      title: "Reconciliation variance",
      message: `Unexplained difference of ${calc.difference} for ${data.materialId}.`,
      resource: PRODUCTION_COLLECTIONS.reconciliations,
      resourceId: id,
      severity: "warning",
      audienceRoles: ["production", "qa"],
    });
  }
  return { id, record };
}

export async function recordWastage(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "reconciliation:create");
  const data = parseOrFail(wastageSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = await issueProductionNumber("WST", options.session, options.idToken);
  const record = {
    wastageId: id,
    wastageNumber: numbered.documentNumber,
    ...data,
    recordedBy: options.session.uid,
    approvedBy: "",
    status: "recorded",
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(PRODUCTION_COLLECTIONS.wastage, id, record, { exists: false })], options.idToken);
  await auditProduction(options.idToken, options.session, {
    action: "WASTAGE_RECORDED",
    resource: PRODUCTION_COLLECTIONS.wastage,
    resourceId: id,
    description: `Recorded wastage ${data.quantity} ${data.uom}.`,
    newData: { reason: data.reason, quantity: data.quantity },
  });
  return { id, record };
}

export async function createDeviation(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "productionDeviation:create");
  const data = parseOrFail(deviationSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = await issueProductionNumber("DEV", options.session, options.idToken);
  const record = {
    deviationId: id,
    deviationNumber: numbered.documentNumber,
    ...data,
    reportedBy: options.session.uid,
    reportedAt: new Date().toISOString(),
    status: data.status || "open",
    searchIndex: searchIndex(numbered.documentNumber, data.batchNumber, data.description),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(PRODUCTION_COLLECTIONS.deviations, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function saveProcessTemplate(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "bom:update");
  const data = parseOrFail(processTemplateSchema, options.payload);
  const id = crypto.randomUUID();
  const record = { templateId: id, ...data, ...actorStamp(options.session) };
  await commitWrites([writeOf(PRODUCTION_COLLECTIONS.processTemplates, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function loadMaterialPlan(manufacturingOrderId: string, idToken: string) {
  const order = await requireRecord(PRODUCTION_COLLECTIONS.orders, manufacturingOrderId, idToken, "Manufacturing order");
  const bom = await requireRecord(PRODUCTION_COLLECTIONS.boms, text(order.bomId), idToken, "BOM");
  const bomItems = await listByField(PRODUCTION_COLLECTIONS.bomItems, "bomId", String(bom.id), idToken);
  const required = calculateMaterialRequirements({
    bomBatchSize: Number(bom.batchSize || 0),
    orderBatchSize: Number(order.batchSize || 0),
    items: bomItems.map((item) => ({
      materialId: text(item.materialId),
      quantity: Number(item.quantity || 0),
      uom: text(item.uom),
      wastageAllowance: Number(item.wastageAllowance || 0),
      materialStage: text(item.materialStage),
      sequence: Number(item.sequence || 0),
    })),
  });
  const availability = await checkMaterialAvailability(required, idToken, { warehouseId: text(order.warehouseId) || undefined });
  return { order, bom, required, availability };
}
