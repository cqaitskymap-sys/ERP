import { searchIndex } from "@/lib/inventory/keys";
import { applyApprovalAction, createApprovalWrites, loadApprovals, loadWorkflowConfig, QC_WORKFLOW_MODULES } from "@/lib/qc/approvals";
import { QC_COLLECTIONS } from "@/lib/qc/collections";
import { DEFAULT_MAX_RETESTS } from "@/lib/qc/config";
import { checkAnalystEligibility, checkInstrumentEligibility, checkStandardEligibility } from "@/lib/qc/eligibility";
import { applyCalculation, evaluateOverallResult, evaluateTestResult } from "@/lib/qc/evaluation";
import {
  actorStamp,
  auditQc,
  commitWrites,
  electronicSignature,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueQcNumber,
  listByField,
  notifyQc,
  parseOrFail,
  requireRecord,
  reuseIdempotent,
  text,
  workflowFail,
  writeOf,
} from "@/lib/qc/helpers";
import { canTransition, SAMPLE_REQUEST_TRANSITIONS, SAMPLE_TRANSITIONS, SPEC_TRANSITIONS, TEST_TRANSITIONS } from "@/lib/qc/status";
import { queryMasterDocuments, readMasterDocument, type AtomicWrite } from "@/lib/masters/firestore";
import {
  assignmentSchema,
  dispositionSchema,
  instrumentSchema,
  oosSchema,
  ootSchema,
  qcDocumentSchema,
  recordResultsSchema,
  resamplingSchema,
  retestSchema,
  sampleReceiveSchema,
  sampleRequestSchema,
  sampleSchema,
  specificationSchema,
  stabilitySchema,
  standardSchema,
  testMethodSchema,
  testRequestSchema,
} from "@/lib/validation/qc";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";
import type { SessionPayload } from "@/types/auth";

async function loadEffectiveSpec(options: { productId?: string; materialId?: string; idToken: string; asOf?: string }) {
  const asOf = options.asOf || new Date().toISOString().slice(0, 10);
  const field = options.materialId ? "materialId" : "productId";
  const value = options.materialId || options.productId;
  if (!value) return null;
  const rows = await queryMasterDocuments(QC_COLLECTIONS.specifications, options.idToken, {
    filters: [{ field, value }],
    limit: 50,
  });
  return (
    rows
      .filter((row) => ["approved", "effective"].includes(text(row.status)))
      .filter((row) => text(row.effectiveDate) <= asOf && (!text(row.expiryDate) || text(row.expiryDate) >= asOf))
      .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0] || null
  );
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

export async function createSampleRequest(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
  systemGenerated?: boolean;
}) {
  if (!options.systemGenerated) ensurePermission(options.session, "qcSample:create");
  const data = parseOrFail(sampleRequestSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  if (data.productId) await requireRecord("products", data.productId, options.idToken, "Product");
  if (data.materialId) await requireRecord("materials", data.materialId, options.idToken, "Material");
  const id = crypto.randomUUID();
  const numbered = await issueQcNumber("SMPREQ", options.session, options.idToken);
  const record = {
    sampleRequestId: id,
    sampleRequestNumber: numbered.documentNumber,
    ...data,
    requestedBy: options.session.uid,
    requestedAt: new Date().toISOString(),
    status: "draft",
    searchIndex: searchIndex(numbered.documentNumber, data.batchNumber, data.productId, data.materialId),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(QC_COLLECTIONS.sampleRequests, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditQc(options.idToken, options.session, {
    action: "SAMPLE_CREATED",
    resource: QC_COLLECTIONS.sampleRequests,
    resourceId: id,
    description: `Created sample request ${numbered.documentNumber}.`,
    newData: { sampleRequestNumber: numbered.documentNumber, sourceType: data.sourceType },
  });
  await notifyQc(options.idToken, options.session, {
    type: "sample_pending",
    title: "Sample pending",
    message: `${numbered.documentNumber} is waiting for sampling.`,
    resource: QC_COLLECTIONS.sampleRequests,
    resourceId: id,
    audienceRoles: ["qc", "warehouse"],
  });
  return { id, record };
}

export async function createSampleRequestFromManufacturing(options: {
  order: Record<string, unknown> & { id?: string };
  session: SessionPayload;
  idToken: string;
}) {
  const orderId = String(options.order.id || options.order.manufacturingOrderId || "");
  if (!orderId) return null;
  const existing = await queryMasterDocuments(QC_COLLECTIONS.sampleRequests, options.idToken, {
    filters: [{ field: "manufacturingOrderId", value: orderId }],
    limit: 1,
  });
  if (existing.length) return { id: String(existing[0].id), record: existing[0] };
  return createSampleRequest({
    payload: {
      sourceType: "finished_product",
      sourceRecordId: orderId,
      manufacturingOrderId: orderId,
      productId: text(options.order.productId),
      customerId: text(options.order.customerId),
      batchNumber: text(options.order.batchNumber),
      warehouseId: text(options.order.warehouseId),
      priority: "high",
      remarks: "Created automatically when manufacturing reached QC Pending.",
      idempotencyKey: `mo-qc-${orderId}`,
    },
    session: options.session,
    idToken: options.idToken,
    systemGenerated: true,
  });
}

export async function createSampleRequestFromGoodsReceipt(options: {
  receipt: Record<string, unknown> & { id?: string };
  items: Array<Record<string, unknown> & { id?: string }>;
  session: SessionPayload;
  idToken: string;
}) {
  const receiptId = String(options.receipt.id || "");
  if (!receiptId) return [];
  const created: Array<{ id: string; record: Record<string, unknown> }> = [];
  for (const item of options.items) {
    const itemId = String(item.id || "");
    const sourceType = text(item.itemType) === "product" ? "finished_product" : "raw_material_receipt";
    const result = await createSampleRequest({
      payload: {
        sourceType,
        sourceRecordId: receiptId,
        goodsReceiptId: receiptId,
        vendorId: text(options.receipt.supplierId || options.receipt.vendorId),
        warehouseId: text(options.receipt.warehouseId),
        plantId: text(options.receipt.plantId),
        materialId: text(item.materialId),
        productId: text(item.productId),
        batchNumber: text(item.batchNumber),
        priority: "normal",
        remarks: "Created automatically from goods receipt into quarantine.",
        idempotencyKey: `gr-qc-${receiptId}-${itemId}`,
      },
      session: options.session,
      idToken: options.idToken,
      systemGenerated: true,
    });
    created.push(result);
  }
  return created;
}

export async function actOnSampleRequest(options: {
  id: string;
  action: "submit" | "approve" | "reject" | "cancel";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const record = await requireRecord(QC_COLLECTIONS.sampleRequests, options.id, options.idToken, "Sample request");
  if (options.action === "submit") {
    ensurePermission(options.session, "qcSample:update");
    if (!canTransition(SAMPLE_REQUEST_TRANSITIONS, text(record.status), "requested")) workflowFail(text(record.status), "submit");
    const next = { ...record, status: "requested", ...actorStamp(options.session, record) };
    await commitWrites([writeOf(QC_COLLECTIONS.sampleRequests, options.id, next)], options.idToken);
    return { id: options.id, record: next };
  }
  if (options.action === "approve") {
    ensurePermission(options.session, "qcSample:approve");
    const next = { ...record, status: "approved", ...actorStamp(options.session, record), approvalSignature: electronicSignature(options.session, "approve", options.comment) };
    await commitWrites([writeOf(QC_COLLECTIONS.sampleRequests, options.id, next)], options.idToken);
    return { id: options.id, record: next };
  }
  if (options.action === "cancel" || options.action === "reject") {
    ensurePermission(options.session, "qcSample:update");
    const next = { ...record, status: "cancelled", ...actorStamp(options.session, record) };
    await commitWrites([writeOf(QC_COLLECTIONS.sampleRequests, options.id, next)], options.idToken);
    return { id: options.id, record: next };
  }
  fail("Unknown sample request action.");
}

export async function registerSample(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcSample:create");
  const data = parseOrFail(sampleSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  if (data.productId) await requireRecord("products", data.productId, options.idToken, "Product");
  if (data.materialId) await requireRecord("materials", data.materialId, options.idToken, "Material");
  const id = crypto.randomUUID();
  const numbered = await issueQcNumber("SMP", options.session, options.idToken);
  const record = {
    sampleId: id,
    sampleNumber: numbered.documentNumber,
    ...data,
    sampledBy: options.session.uid,
    sampledAt: new Date().toISOString(),
    status: "sampled",
    searchIndex: searchIndex(numbered.documentNumber, data.batchNumber, data.productId, data.materialId),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(QC_COLLECTIONS.samples, id, record, { exists: false })];
  if (data.sampleRequestId) {
    const request = await requireRecord(QC_COLLECTIONS.sampleRequests, data.sampleRequestId, options.idToken, "Sample request");
    writes.push(writeOf(QC_COLLECTIONS.sampleRequests, data.sampleRequestId, { ...request, status: "sampled", ...actorStamp(options.session, request) }));
  }
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditQc(options.idToken, options.session, {
    action: "SAMPLE_REGISTERED",
    resource: QC_COLLECTIONS.samples,
    resourceId: id,
    description: `Registered sample ${numbered.documentNumber}.`,
    newData: { sampleNumber: numbered.documentNumber, batchNumber: data.batchNumber },
  });
  return { id, record };
}

export async function receiveSample(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcSample:receive");
  const data = parseOrFail(sampleReceiveSchema, options.payload);
  const record = await requireRecord(QC_COLLECTIONS.samples, options.id, options.idToken, "Sample");
  if (!["sampled", "in_transit", "planned"].includes(text(record.status))) workflowFail(text(record.status), "receive");
  const acceptable = data.condition === "acceptable";
  const next = {
    ...record,
    receivedBy: options.session.uid,
    receivedAt: data.receivedAt || new Date().toISOString(),
    condition: data.condition,
    containerIntegrity: data.containerIntegrity || "",
    quantityReceived: data.quantityReceived || record.quantity,
    storageCondition: data.storageCondition || record.storageCondition,
    status: acceptable ? "received" : "disposed",
    receiptDisposition: acceptable ? "" : data.disposition || "hold",
    remarks: data.remarks || record.remarks,
    ...actorStamp(options.session, record),
  };
  if (!acceptable && !data.disposition && !data.remarks) {
    fail("Unacceptable samples require a controlled disposition or remarks before testing can continue.");
  }
  const writes = [writeOf(QC_COLLECTIONS.samples, options.id, next)];
  if (text(record.sampleRequestId)) {
    const request = await readMasterDocument(QC_COLLECTIONS.sampleRequests, text(record.sampleRequestId), options.idToken);
    if (request) writes.push(writeOf(QC_COLLECTIONS.sampleRequests, String(request.id), { ...request, status: acceptable ? "received" : request.status, ...actorStamp(options.session, request) }));
  }
  await commitWrites(writes, options.idToken);
  await auditQc(options.idToken, options.session, {
    action: "SAMPLE_RECEIVED",
    resource: QC_COLLECTIONS.samples,
    resourceId: options.id,
    description: `Received sample ${text(record.sampleNumber)} as ${data.condition}.`,
    oldData: { status: record.status },
    newData: { status: next.status, condition: data.condition },
  });
  await notifyQc(options.idToken, options.session, {
    type: "sample_received",
    title: "Sample received",
    message: `${text(record.sampleNumber)} was received (${data.condition}).`,
    resource: QC_COLLECTIONS.samples,
    resourceId: options.id,
    audienceRoles: ["qc"],
  });
  return { id: options.id, record: next };
}

export async function registerReceivedSample(options: { id: string; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcSample:update");
  const record = await requireRecord(QC_COLLECTIONS.samples, options.id, options.idToken, "Sample");
  if (text(record.condition) && text(record.condition) !== "acceptable") {
    fail("Unacceptable samples cannot be registered for testing.");
  }
  if (!canTransition(SAMPLE_TRANSITIONS, text(record.status), "registered")) workflowFail(text(record.status), "register");
  const next = { ...record, status: "registered", ...actorStamp(options.session, record) };
  await commitWrites([writeOf(QC_COLLECTIONS.samples, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function createSpecification(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcSpecification:create");
  const data = parseOrFail(specificationSchema, options.payload);
  if (!data.productId && !data.materialId) fail("A product or material is required.");
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const previous = await queryMasterDocuments(QC_COLLECTIONS.specifications, options.idToken, {
    filters: [{ field: data.materialId ? "materialId" : "productId", value: String(data.materialId || data.productId) }],
    limit: 50,
  });
  const version = Math.max(0, ...previous.map((row) => Number(row.version || 0))) + 1;
  const id = crypto.randomUUID();
  const numbered = await issueQcNumber("SPEC", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const items = data.items.map((item, index) => {
    const itemId = crypto.randomUUID();
    const record = { parameterId: itemId, specificationId: id, sequence: item.sequence || index + 1, mandatory: item.mandatory !== false, ...item, ...actorStamp(options.session) };
    writes.push(writeOf(QC_COLLECTIONS.specificationItems, itemId, record, { exists: false }));
    return record;
  });
  const record = {
    specificationId: id,
    specificationNumber: numbered.documentNumber,
    productId: data.productId || "",
    materialId: data.materialId || "",
    version,
    effectiveDate: data.effectiveDate,
    expiryDate: data.expiryDate || "",
    status: "draft",
    approvedBy: "",
    approvedAt: "",
    remarks: data.remarks || "",
    searchIndex: searchIndex(numbered.documentNumber, data.productId, data.materialId, String(version)),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(QC_COLLECTIONS.specifications, id, record, { exists: false }));
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditQc(options.idToken, options.session, {
    action: version === 1 ? "SPECIFICATION_CREATED" : "SPECIFICATION_VERSION_CREATED",
    resource: QC_COLLECTIONS.specifications,
    resourceId: id,
    description: `Created specification ${numbered.documentNumber} version ${version}.`,
    newData: { version },
  });
  return { id, record, items };
}

export async function actOnSpecification(options: {
  id: string;
  action: "submit" | "approve" | "reject" | "return" | "activate";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const record = await requireRecord(QC_COLLECTIONS.specifications, options.id, options.idToken, "Specification");
  if (["effective", "superseded", "obsolete"].includes(text(record.status)) && options.action !== "activate") {
    fail("Approved historical specifications cannot be edited.");
  }
  if (options.action === "submit") {
    ensurePermission(options.session, "qcSpecification:submit");
    if (!canTransition(SPEC_TRANSITIONS, text(record.status), "under_review")) workflowFail(text(record.status), "submit");
    const { writes } = await startApprovals({
      module: QC_WORKFLOW_MODULES.specification,
      documentType: "specification",
      documentId: options.id,
      documentNumber: text(record.specificationNumber),
      requestedBy: text(record.createdBy),
      session: options.session,
      idToken: options.idToken,
    });
    const next = { ...record, status: "under_review", ...actorStamp(options.session, record) };
    await commitWrites([writeOf(QC_COLLECTIONS.specifications, options.id, next), ...writes], options.idToken);
    return { id: options.id, record: next };
  }
  if (options.action === "approve" || options.action === "reject" || options.action === "return") {
    ensurePermission(options.session, "qcSpecification:approve");
    const approvals = await loadApprovals("specification", options.id, options.idToken);
    const workflow = await loadWorkflowConfig(QC_WORKFLOW_MODULES.specification, options.idToken);
    const result = applyApprovalAction({
      documentType: "specification",
      approvals,
      action: options.action === "return" ? "return" : options.action,
      comment: options.comment,
      session: options.session,
      allowSelfApproval: workflow.allowSelfApproval,
      requestedBy: text(record.createdBy),
    });
    const status = result.rejected ? "draft" : result.completed ? "approved" : "under_review";
    const next = {
      ...record,
      status,
      approvedBy: result.completed ? options.session.uid : record.approvedBy,
      approvedAt: result.completed ? new Date().toISOString() : record.approvedAt,
      approvalSignature: result.completed ? electronicSignature(options.session, "approve", options.comment) : record.approvalSignature,
      ...actorStamp(options.session, record),
    };
    await commitWrites([writeOf(QC_COLLECTIONS.specifications, options.id, next), ...result.writes], options.idToken);
    if (result.completed) {
      await auditQc(options.idToken, options.session, {
        action: "SPECIFICATION_APPROVED",
        resource: QC_COLLECTIONS.specifications,
        resourceId: options.id,
        description: `Approved specification ${text(record.specificationNumber)}.`,
        oldData: { status: record.status },
        newData: { status: "approved" },
      });
    }
    return { id: options.id, record: next };
  }
  if (options.action === "activate") {
    ensurePermission(options.session, "qcSpecification:approve");
    if (!canTransition(SPEC_TRANSITIONS, text(record.status), "effective") && text(record.status) !== "approved") {
      workflowFail(text(record.status), "activate");
    }
    const previous = await queryMasterDocuments(QC_COLLECTIONS.specifications, options.idToken, {
      filters: [{ field: record.materialId ? "materialId" : "productId", value: text(record.materialId || record.productId) }],
      limit: 50,
    });
    const writes = previous
      .filter((row) => text(row.status) === "effective" && String(row.id) !== options.id)
      .map((row) => writeOf(QC_COLLECTIONS.specifications, String(row.id), { ...row, status: "superseded", ...actorStamp(options.session, row) }));
    const next = { ...record, status: "effective", ...actorStamp(options.session, record) };
    await commitWrites([writeOf(QC_COLLECTIONS.specifications, options.id, next), ...writes], options.idToken);
    return { id: options.id, record: next };
  }
  fail("Unknown specification action.");
}

export async function createTestMethod(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcTestMethod:create");
  const data = parseOrFail(testMethodSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const previous = await queryMasterDocuments(QC_COLLECTIONS.methods, options.idToken, {
    filters: [{ field: "methodName", value: data.methodName }],
    limit: 50,
  });
  const version = Math.max(0, ...previous.map((row) => Number(row.version || 0))) + 1;
  const id = crypto.randomUUID();
  const numbered = await issueQcNumber("METHOD", options.session, options.idToken);
  const record = {
    testMethodId: id,
    methodNumber: numbered.documentNumber,
    ...data,
    version,
    status: "draft",
    approvedBy: "",
    approvedAt: "",
    searchIndex: searchIndex(numbered.documentNumber, data.methodName),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(QC_COLLECTIONS.methods, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function actOnTestMethod(options: { id: string; action: "submit" | "approve"; comment?: string; session: SessionPayload; idToken: string }) {
  const record = await requireRecord(QC_COLLECTIONS.methods, options.id, options.idToken, "Test method");
  if (["effective", "superseded", "obsolete", "approved"].includes(text(record.status)) && options.action !== "approve") {
    fail("Approved test methods cannot be overwritten.");
  }
  if (options.action === "submit") {
    ensurePermission(options.session, "qcTestMethod:update");
    const next = { ...record, status: "under_review", ...actorStamp(options.session, record) };
    await commitWrites([writeOf(QC_COLLECTIONS.methods, options.id, next)], options.idToken);
    return { id: options.id, record: next };
  }
  ensurePermission(options.session, "qcTestMethod:approve");
  const next = {
    ...record,
    status: "effective",
    approvedBy: options.session.uid,
    approvedAt: new Date().toISOString(),
    approvalSignature: electronicSignature(options.session, "approve", options.comment),
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(QC_COLLECTIONS.methods, options.id, next)], options.idToken);
  await auditQc(options.idToken, options.session, {
    action: "TEST_METHOD_APPROVED",
    resource: QC_COLLECTIONS.methods,
    resourceId: options.id,
    description: `Approved test method ${text(record.methodNumber)}.`,
    newData: { status: "effective" },
  });
  return { id: options.id, record: next };
}

export async function createTestRequest(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcTest:create");
  const data = parseOrFail(testRequestSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const sample = await requireRecord(QC_COLLECTIONS.samples, data.sampleId, options.idToken, "Sample");
  if (text(sample.condition) && text(sample.condition) !== "acceptable") fail("Unacceptable samples cannot enter testing.");
  if (!["received", "registered", "testing"].includes(text(sample.status))) fail("Sample must be received or registered before testing.");
  const spec = data.specificationId
    ? await requireRecord(QC_COLLECTIONS.specifications, data.specificationId, options.idToken, "Specification")
    : await loadEffectiveSpec({ productId: text(data.productId || sample.productId), materialId: text(data.materialId || sample.materialId), idToken: options.idToken });
  if (!spec) fail("An effective specification is required.");
  if (!["approved", "effective"].includes(text(spec.status))) fail("Linked specification is not effective.");
  const items = await listByField(QC_COLLECTIONS.specificationItems, "specificationId", String(spec.id), options.idToken);
  const id = crypto.randomUUID();
  const numbered = await issueQcNumber("TESTREQ", options.session, options.idToken);
  const testId = crypto.randomUUID();
  const testNumber = await issueQcNumber("TEST", options.session, options.idToken);
  const request = {
    testRequestId: id,
    testRequestNumber: numbered.documentNumber,
    sampleId: data.sampleId,
    productId: data.productId || sample.productId,
    materialId: data.materialId || sample.materialId,
    batchNumber: data.batchNumber || sample.batchNumber,
    specificationId: String(spec.id),
    specificationVersion: spec.version,
    requestedBy: options.session.uid,
    requestedAt: new Date().toISOString(),
    priority: data.priority,
    dueDate: data.dueDate || "",
    status: "requested",
    remarks: data.remarks || "",
    searchIndex: searchIndex(numbered.documentNumber, sample.sampleNumber, data.batchNumber || sample.batchNumber),
    ...actorStamp(options.session),
  };
  const test = {
    testId,
    testNumber: testNumber.documentNumber,
    testRequestId: id,
    sampleId: data.sampleId,
    specificationId: String(spec.id),
    specificationVersion: spec.version,
    methodVersion: "",
    originalTestId: "",
    retestSequence: 0,
    status: "requested",
    overallResult: "pending",
    analystId: "",
    startedAt: "",
    submittedAt: "",
    searchIndex: searchIndex(testNumber.documentNumber, sample.sampleNumber),
    ...actorStamp(options.session),
  };
  await commitWrites(
    [
      writeOf(QC_COLLECTIONS.testRequests, id, request, { exists: false }),
      writeOf(QC_COLLECTIONS.tests, testId, test, { exists: false }),
      writeOf(QC_COLLECTIONS.samples, data.sampleId, { ...sample, status: "testing", ...actorStamp(options.session, sample) }),
    ],
    options.idToken
  );
  await auditQc(options.idToken, options.session, {
    action: "TEST_CREATED",
    resource: QC_COLLECTIONS.testRequests,
    resourceId: id,
    description: `Created test request ${numbered.documentNumber} against specification v${spec.version}.`,
    newData: { specificationId: spec.id, specificationVersion: spec.version, parameterCount: items.length },
  });
  return { id, record: request, test: { id: testId, record: test }, items };
}

export async function assignTest(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcTest:assign");
  const data = parseOrFail(assignmentSchema, options.payload);
  const request = await requireRecord(QC_COLLECTIONS.testRequests, data.testRequestId, options.idToken, "Test request");
  const user = await readMasterDocument("users", data.analystId, options.idToken);
  const check = checkAnalystEligibility(user);
  if (!check.eligible) fail(check.reasons[0] || "Analyst is not eligible.");
  const tests = data.testId
    ? [await requireRecord(QC_COLLECTIONS.tests, data.testId, options.idToken, "Test")]
    : await listByField(QC_COLLECTIONS.tests, "testRequestId", data.testRequestId, options.idToken);
  const id = crypto.randomUUID();
  const assignment = {
    assignmentId: id,
    testRequestId: data.testRequestId,
    testId: String(tests[0]?.id || data.testId || ""),
    analystId: data.analystId,
    assignedBy: options.session.uid,
    assignedAt: new Date().toISOString(),
    dueDate: data.dueDate || request.dueDate,
    priority: data.priority,
    status: "assigned",
    ...actorStamp(options.session),
  };
  const writes = [
    writeOf(QC_COLLECTIONS.assignments, id, assignment, { exists: false }),
    writeOf(QC_COLLECTIONS.testRequests, data.testRequestId, { ...request, status: "assigned", analystId: data.analystId, ...actorStamp(options.session, request) }),
    ...tests.map((test) => writeOf(QC_COLLECTIONS.tests, String(test.id), { ...test, status: "assigned", analystId: data.analystId, ...actorStamp(options.session, test) })),
  ];
  await commitWrites(writes, options.idToken);
  await auditQc(options.idToken, options.session, {
    action: "TEST_ASSIGNED",
    resource: QC_COLLECTIONS.assignments,
    resourceId: id,
    description: `Assigned test ${text(request.testRequestNumber)} to analyst.`,
    newData: { analystId: data.analystId },
  });
  await notifyQc(options.idToken, options.session, {
    type: "test_assigned",
    title: "Test assigned",
    message: `${text(request.testRequestNumber)} was assigned for laboratory testing.`,
    resource: QC_COLLECTIONS.testRequests,
    resourceId: data.testRequestId,
    audienceRoles: ["qc"],
  });
  return { id, record: assignment };
}

export async function startTest(options: { id: string; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcTest:execute");
  const test = await requireRecord(QC_COLLECTIONS.tests, options.id, options.idToken, "Test");
  if (!canTransition(TEST_TRANSITIONS, text(test.status), "in_testing") && text(test.status) !== "assigned") {
    workflowFail(text(test.status), "start");
  }
  if (text(test.analystId) && text(test.analystId) !== options.session.uid && options.session.role === "qc") {
    fail("Only the assigned analyst can start this controlled test.");
  }
  const next = { ...test, status: "in_testing", startedAt: new Date().toISOString(), ...actorStamp(options.session, test) };
  const request = await requireRecord(QC_COLLECTIONS.testRequests, text(test.testRequestId), options.idToken, "Test request");
  await commitWrites(
    [
      writeOf(QC_COLLECTIONS.tests, options.id, next),
      writeOf(QC_COLLECTIONS.testRequests, String(request.id), { ...request, status: "in_testing", ...actorStamp(options.session, request) }),
    ],
    options.idToken
  );
  await auditQc(options.idToken, options.session, {
    action: "TEST_STARTED",
    resource: QC_COLLECTIONS.tests,
    resourceId: options.id,
    description: `Started test ${text(test.testNumber)}.`,
    oldData: { status: test.status },
    newData: { status: "in_testing" },
  });
  return { id: options.id, record: next };
}

export async function recordTestResult(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcTest:execute");
  const data = parseOrFail(recordResultsSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const test = await requireRecord(QC_COLLECTIONS.tests, data.testId, options.idToken, "Test");
  if (["completed", "reviewed"].includes(text(test.status))) fail("Approved historical results cannot be overwritten.");
  if (text(test.analystId) && text(test.analystId) !== options.session.uid && options.session.role === "qc") {
    fail("Only the assigned analyst can enter results for this test.");
  }
  if (data.instrumentId) {
    const instrument = await requireRecord(QC_COLLECTIONS.instruments, data.instrumentId, options.idToken, "Instrument");
    const check = checkInstrumentEligibility(instrument);
    if (!check.eligible) fail(check.reasons[0] || "Instrument is not eligible.");
  }
  if (data.standardId) {
    const standard = await requireRecord(QC_COLLECTIONS.standards, data.standardId, options.idToken, "Reference standard");
    const check = checkStandardEligibility(standard);
    if (!check.eligible) fail(check.reasons[0] || "Reference standard is not eligible.");
  }
  const previous = await listByField(QC_COLLECTIONS.results, "testId", data.testId, options.idToken);
  const writes: AtomicWrite[] = [];
  const evaluated = data.lines.map((line) => {
    let computed: unknown = line.enteredResult;
    if (line.testType === "calculated") computed = applyCalculation(line.calculatedResult || String(line.enteredResult), line.enteredResult);
    const evaluation = evaluateTestResult({
      testType: line.testType,
      enteredResult: line.enteredResult,
      calculatedResult: computed,
      minimum: line.minimum,
      maximum: line.maximum,
      target: line.target,
      acceptanceCriteria: line.acceptanceCriteria,
    });
    if (evaluation.outcome === "invalid") fail(evaluation.reason);
    const id = crypto.randomUUID();
    const record = {
      resultId: id,
      testId: data.testId,
      testRequestId: test.testRequestId,
      sampleId: test.sampleId,
      batchNumber: test.batchNumber || "",
      specificationId: test.specificationId,
      specificationVersion: test.specificationVersion,
      parameterId: line.parameterId,
      parameterName: line.parameterName,
      testType: line.testType,
      unit: line.unit || "",
      target: line.target || "",
      minimum: line.minimum || "",
      maximum: line.maximum || "",
      acceptanceCriteria: line.acceptanceCriteria || "",
      mandatory: line.mandatory !== false,
      enteredResult: line.enteredResult || "",
      calculatedResult: computed ?? "",
      outcome: evaluation.outcome,
      evaluationReason: evaluation.reason,
      instrumentId: line.instrumentId || data.instrumentId || "",
      standardId: line.standardId || data.standardId || "",
      testMethodId: line.testMethodId || "",
      resultVersion: previous.filter((row) => text(row.parameterId) === line.parameterId).length + 1,
      supersededResultId: previous.find((row) => text(row.parameterId) === line.parameterId)?.id || "",
      remarks: line.remarks || "",
      enteredBy: options.session.uid,
      enteredAt: new Date().toISOString(),
      ...actorStamp(options.session),
    };
    writes.push(writeOf(QC_COLLECTIONS.results, id, record, { exists: false }));
    return record;
  });
  const overall = evaluateOverallResult(evaluated.map((row) => ({ outcome: text(row.outcome), mandatory: Boolean(row.mandatory) })));
  const nextTest = {
    ...test,
    overallResult: overall.overall,
    passedCount: overall.passed,
    failedCount: overall.failed,
    pendingCount: overall.pending,
    instrumentId: data.instrumentId || test.instrumentId,
    standardId: data.standardId || test.standardId,
    ...actorStamp(options.session, test),
  };
  writes.push(writeOf(QC_COLLECTIONS.tests, data.testId, nextTest));
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id: data.testId, record: nextTest, results: evaluated }, options.session));
  await commitWrites(writes, options.idToken);
  await auditQc(options.idToken, options.session, {
    action: previous.length ? "RESULT_MODIFIED" : "RESULT_ENTERED",
    resource: QC_COLLECTIONS.tests,
    resourceId: data.testId,
    description: `Recorded ${evaluated.length} results for ${text(test.testNumber)}.`,
    oldData: { overallResult: test.overallResult },
    newData: { overallResult: overall.overall },
    reason: data.reason,
  });
  return { id: data.testId, record: nextTest, results: evaluated, overall };
}

export async function submitTest(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcTest:execute");
  const test = await requireRecord(QC_COLLECTIONS.tests, options.id, options.idToken, "Test");
  if (!canTransition(TEST_TRANSITIONS, text(test.status), "review_pending") && text(test.status) !== "in_testing") {
    workflowFail(text(test.status), "submit");
  }
  const results = await listByField(QC_COLLECTIONS.results, "testId", options.id, options.idToken);
  if (!results.length) fail("Results must be recorded before submission.");
  const overall = evaluateOverallResult(results.map((row) => ({ outcome: text(row.outcome), mandatory: row.mandatory !== false })));
  if (overall.overall === "pending") fail("Mandatory results are still pending.");
  const request = await requireRecord(QC_COLLECTIONS.testRequests, text(test.testRequestId), options.idToken, "Test request");
  const next = {
    ...test,
    status: "review_pending",
    overallResult: overall.overall,
    submittedAt: new Date().toISOString(),
    submitSignature: electronicSignature(options.session, "submit", options.comment),
    ...actorStamp(options.session, test),
  };
  await commitWrites(
    [
      writeOf(QC_COLLECTIONS.tests, options.id, next),
      writeOf(QC_COLLECTIONS.testRequests, String(request.id), { ...request, status: "review_pending", ...actorStamp(options.session, request) }),
    ],
    options.idToken
  );
  await auditQc(options.idToken, options.session, {
    action: "RESULT_SUBMITTED",
    resource: QC_COLLECTIONS.tests,
    resourceId: options.id,
    description: `Submitted ${text(test.testNumber)} for QC review.`,
    newData: { overallResult: overall.overall },
  });
  await notifyQc(options.idToken, options.session, {
    type: "qc_review_pending",
    title: "QC review pending",
    message: `${text(test.testNumber)} is waiting for QC review.`,
    resource: QC_COLLECTIONS.tests,
    resourceId: options.id,
    audienceRoles: ["qc", "qa"],
  });
  if (overall.overall === "fail") {
    await notifyQc(options.idToken, options.session, {
      type: "retest_required",
      title: "Failed result submitted",
      message: `${text(test.testNumber)} failed specification. Create OOS if required.`,
      resource: QC_COLLECTIONS.tests,
      resourceId: options.id,
      audienceRoles: ["qc", "qa"],
    });
  }
  return { id: options.id, record: next, overall };
}

export async function reviewTest(options: {
  id: string;
  action: "approve" | "reject" | "return";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, options.action === "approve" ? "qcTest:approve" : "qcTest:review");
  const test = await requireRecord(QC_COLLECTIONS.tests, options.id, options.idToken, "Test");
  if (text(test.status) !== "review_pending") workflowFail(text(test.status), options.action);
  const workflow = await loadWorkflowConfig(QC_WORKFLOW_MODULES.test, options.idToken);
  if (!workflow.allowSelfApproval && text(test.analystId) === options.session.uid) {
    fail("Separation of duties prevents an analyst from approving their own controlled results.");
  }
  const request = await requireRecord(QC_COLLECTIONS.testRequests, text(test.testRequestId), options.idToken, "Test request");
  const nextStatus = options.action === "approve" ? "completed" : options.action === "return" ? "in_testing" : "rejected";
  const requestStatus = options.action === "approve" ? "completed" : options.action === "return" ? "in_testing" : "rejected";
  const next = {
    ...test,
    status: nextStatus,
    reviewSignature: electronicSignature(options.session, options.action, options.comment),
    reviewedBy: options.session.uid,
    reviewedAt: new Date().toISOString(),
    ...actorStamp(options.session, test),
  };
  const writes = [
    writeOf(QC_COLLECTIONS.tests, options.id, next),
    writeOf(QC_COLLECTIONS.testRequests, String(request.id), { ...request, status: requestStatus, ...actorStamp(options.session, request) }),
  ];
  if (options.action === "approve") {
    const sample = await readMasterDocument(QC_COLLECTIONS.samples, text(test.sampleId), options.idToken);
    if (sample) writes.push(writeOf(QC_COLLECTIONS.samples, String(sample.id), { ...sample, status: "completed", ...actorStamp(options.session, sample) }));
  }
  await commitWrites(writes, options.idToken);
  await auditQc(options.idToken, options.session, {
    action: options.action === "approve" ? "RESULT_APPROVED" : "RESULT_REVIEWED",
    resource: QC_COLLECTIONS.tests,
    resourceId: options.id,
    description: `${options.action} ${text(test.testNumber)}.`,
    oldData: { status: test.status },
    newData: { status: nextStatus },
    reason: options.comment,
  });
  return { id: options.id, record: next };
}

export async function createOOS(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcOos:create");
  const data = parseOrFail(oosSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = await issueQcNumber("OOS", options.session, options.idToken);
  const record = {
    oosId: id,
    oosNumber: numbered.documentNumber,
    ...data,
    reportedBy: options.session.uid,
    reportedAt: new Date().toISOString(),
    status: data.status || "open",
    searchIndex: searchIndex(numbered.documentNumber, data.batchNumber, data.parameter),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(QC_COLLECTIONS.oos, id, record, { exists: false })], options.idToken);
  await auditQc(options.idToken, options.session, {
    action: "OOS_CREATED",
    resource: QC_COLLECTIONS.oos,
    resourceId: id,
    description: `Created OOS ${numbered.documentNumber}.`,
    newData: { parameter: data.parameter, observedResult: data.observedResult },
  });
  await notifyQc(options.idToken, options.session, {
    type: "oos_created",
    title: "OOS created",
    message: `${numbered.documentNumber} is open for investigation.`,
    resource: QC_COLLECTIONS.oos,
    resourceId: id,
    audienceRoles: ["qc", "qa"],
  });
  return { id, record };
}

export async function createOOT(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcOot:create");
  const data = parseOrFail(ootSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = await issueQcNumber("OOT", options.session, options.idToken);
  const record = {
    ootId: id,
    ootNumber: numbered.documentNumber,
    ...data,
    reportedBy: options.session.uid,
    reportedAt: new Date().toISOString(),
    status: data.status || "open",
    searchIndex: searchIndex(numbered.documentNumber, data.batchNumber, data.parameter),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(QC_COLLECTIONS.oot, id, record, { exists: false })], options.idToken);
  await auditQc(options.idToken, options.session, {
    action: "OOT_CREATED",
    resource: QC_COLLECTIONS.oot,
    resourceId: id,
    description: `Created OOT ${numbered.documentNumber}.`,
    newData: { parameter: data.parameter },
  });
  await notifyQc(options.idToken, options.session, {
    type: "oot_created",
    title: "OOT created",
    message: `${numbered.documentNumber} was recorded as a controlled out-of-trend observation.`,
    resource: QC_COLLECTIONS.oot,
    resourceId: id,
    audienceRoles: ["qc", "qa"],
  });
  return { id, record };
}

export async function createRetest(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcRetest:create");
  const data = parseOrFail(retestSchema, options.payload);
  const original = await requireRecord(QC_COLLECTIONS.tests, data.originalTestId, options.idToken, "Original test");
  const prior = await listByField(QC_COLLECTIONS.retests, "originalTestId", data.originalTestId, options.idToken);
  if (prior.length >= DEFAULT_MAX_RETESTS) fail(`Retesting is limited to ${DEFAULT_MAX_RETESTS} controlled cycles.`);
  const request = await requireRecord(QC_COLLECTIONS.testRequests, text(original.testRequestId), options.idToken, "Test request");
  const id = crypto.randomUUID();
  const numbered = await issueQcNumber("RETEST", options.session, options.idToken);
  const testId = crypto.randomUUID();
  const testNumber = await issueQcNumber("TEST", options.session, options.idToken);
  const sequence = prior.length + 1;
  const retest = {
    retestId: id,
    retestNumber: numbered.documentNumber,
    originalTestId: data.originalTestId,
    newTestId: testId,
    reason: data.reason,
    sequence,
    status: "approved",
    ...actorStamp(options.session),
    approvalSignature: electronicSignature(options.session, "retest", data.reason),
  };
  const test = {
    testId,
    testNumber: testNumber.documentNumber,
    testRequestId: original.testRequestId,
    sampleId: original.sampleId,
    specificationId: original.specificationId,
    specificationVersion: original.specificationVersion,
    originalTestId: data.originalTestId,
    retestSequence: sequence,
    status: "assigned",
    overallResult: "pending",
    analystId: data.analystId || original.analystId,
    searchIndex: searchIndex(testNumber.documentNumber, original.testNumber),
    ...actorStamp(options.session),
  };
  await commitWrites(
    [
      writeOf(QC_COLLECTIONS.retests, id, retest, { exists: false }),
      writeOf(QC_COLLECTIONS.tests, testId, test, { exists: false }),
      writeOf(QC_COLLECTIONS.testRequests, String(request.id), { ...request, status: "assigned", ...actorStamp(options.session, request) }),
    ],
    options.idToken
  );
  await auditQc(options.idToken, options.session, {
    action: "RETEST_CREATED",
    resource: QC_COLLECTIONS.retests,
    resourceId: id,
    description: `Created retest ${sequence} for ${text(original.testNumber)}. Original results were preserved.`,
    newData: { originalTestId: data.originalTestId, newTestId: testId },
    reason: data.reason,
  });
  return { id, record: retest, test: { id: testId, record: test } };
}

export async function createResample(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcResampling:create");
  const data = parseOrFail(resamplingSchema, options.payload);
  const original = await requireRecord(QC_COLLECTIONS.samples, data.originalSampleId, options.idToken, "Original sample");
  const created = await registerSample({
    payload: {
      sampleRequestId: original.sampleRequestId,
      sampleType: original.sampleType,
      sourceType: original.sourceType,
      sourceRecordId: original.sourceRecordId,
      productId: original.productId,
      materialId: original.materialId,
      batchNumber: original.batchNumber,
      vendorId: original.vendorId,
      goodsReceiptId: original.goodsReceiptId,
      manufacturingOrderId: original.manufacturingOrderId,
      quantity: data.quantity,
      uom: data.uom,
      remarks: `Resample of ${text(original.sampleNumber)}: ${data.reason}`,
      idempotencyKey: `resample-${data.originalSampleId}-${Date.now()}`,
    },
    session: options.session,
    idToken: options.idToken,
  });
  const id = crypto.randomUUID();
  const numbered = await issueQcNumber("RESAMP", options.session, options.idToken);
  const record = {
    resamplingId: id,
    resamplingNumber: numbered.documentNumber,
    originalSampleId: data.originalSampleId,
    newSampleId: created.id,
    reason: data.reason,
    status: "approved",
    approvalSignature: electronicSignature(options.session, "resample", data.reason),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(QC_COLLECTIONS.resampling, id, record, { exists: false })], options.idToken);
  await auditQc(options.idToken, options.session, {
    action: "RESAMPLE_CREATED",
    resource: QC_COLLECTIONS.resampling,
    resourceId: id,
    description: `Created resample ${numbered.documentNumber}. Original sample ${text(original.sampleNumber)} was retained.`,
    reason: data.reason,
  });
  return { id, record, sample: created };
}

export async function generateCOA(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcCoa:create");
  const testRequestId = text(options.payload.testRequestId);
  if (!testRequestId) fail("Test request is required.");
  const reused = await reuseIdempotent(text(options.payload.idempotencyKey), options.idToken);
  if (reused) return reused;
  const request = await requireRecord(QC_COLLECTIONS.testRequests, testRequestId, options.idToken, "Test request");
  const tests = await listByField(QC_COLLECTIONS.tests, "testRequestId", testRequestId, options.idToken);
  const approved = tests.filter((row) => text(row.status) === "completed");
  if (!approved.length) fail("COA can be generated only after QC review and approval.");
  const existing = await listByField(QC_COLLECTIONS.coas, "testRequestId", testRequestId, options.idToken);
  const version = existing.length + 1;
  const sample = await requireRecord(QC_COLLECTIONS.samples, text(request.sampleId), options.idToken, "Sample");
  const results = await listByField(QC_COLLECTIONS.results, "testRequestId", testRequestId, options.idToken);
  const latest = Object.values(
    results.reduce<Record<string, (typeof results)[number]>>((map, row) => {
      const key = text(row.parameterId);
      if (!map[key] || Number(row.resultVersion || 0) > Number(map[key].resultVersion || 0)) map[key] = row;
      return map;
    }, {})
  );
  const overall = evaluateOverallResult(latest.map((row) => ({ outcome: text(row.outcome), mandatory: row.mandatory !== false })));
  const id = crypto.randomUUID();
  const numbered = await issueQcNumber("COA", options.session, options.idToken);
  const record = {
    coaId: id,
    coaNumber: numbered.documentNumber,
    version,
    previousCoaId: existing[0]?.id || "",
    testRequestId,
    sampleId: sample.id,
    sampleNumber: sample.sampleNumber,
    productId: request.productId,
    materialId: request.materialId,
    customerId: sample.customerId || request.customerId || "",
    batchNumber: request.batchNumber,
    manufacturingOrderId: sample.manufacturingOrderId || "",
    specificationId: request.specificationId,
    specificationVersion: request.specificationVersion,
    conclusion: overall.overall === "pass" ? "Complies" : "Does not comply",
    overallResult: overall.overall,
    status: "draft",
    lines: latest.map((row) => ({
      parameterName: row.parameterName,
      unit: row.unit,
      specification: row.acceptanceCriteria || `${row.minimum || ""}–${row.maximum || ""}`,
      result: row.calculatedResult || row.enteredResult,
      outcome: row.outcome,
      methodId: row.testMethodId,
    })),
    searchIndex: searchIndex(numbered.documentNumber, request.batchNumber, request.productId),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(QC_COLLECTIONS.coas, id, record, { exists: false })];
  if (text(options.payload.idempotencyKey)) writes.push(idempotencyWrite(text(options.payload.idempotencyKey), { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditQc(options.idToken, options.session, {
    action: "COA_GENERATED",
    resource: QC_COLLECTIONS.coas,
    resourceId: id,
    description: `Generated COA ${numbered.documentNumber} version ${version}.`,
    newData: { version, overallResult: overall.overall },
  });
  await notifyQc(options.idToken, options.session, {
    type: "coa_pending",
    title: "COA pending",
    message: `${numbered.documentNumber} is waiting for QC approval.`,
    resource: QC_COLLECTIONS.coas,
    resourceId: id,
    audienceRoles: ["qc", "qa"],
  });
  return { id, record };
}

export async function approveCOA(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcCoa:approve");
  const record = await requireRecord(QC_COLLECTIONS.coas, options.id, options.idToken, "COA");
  if (text(record.status) === "approved") fail("Approved COAs cannot be edited. Create a controlled revision.");
  const next = {
    ...record,
    status: "approved",
    approvedBy: options.session.uid,
    approvedAt: new Date().toISOString(),
    approvalSignature: electronicSignature(options.session, "approve", options.comment),
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(QC_COLLECTIONS.coas, options.id, next)], options.idToken);
  await auditQc(options.idToken, options.session, {
    action: "COA_APPROVED",
    resource: QC_COLLECTIONS.coas,
    resourceId: options.id,
    description: `Approved COA ${text(record.coaNumber)}.`,
    oldData: { status: record.status },
    newData: { status: "approved" },
    reason: options.comment,
  });
  await notifyQc(options.idToken, options.session, {
    type: "coa_approved",
    title: "COA approved",
    message: `${text(record.coaNumber)} was approved. QA release is a future module.`,
    resource: QC_COLLECTIONS.coas,
    resourceId: options.id,
    audienceRoles: ["qc", "qa", "production"],
  });
  return { id: options.id, record: next };
}

export async function createQCDisposition(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcTest:approve");
  const data = parseOrFail(dispositionSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = await issueQcNumber("DISP", options.session, options.idToken);
  const record = {
    dispositionId: id,
    dispositionNumber: numbered.documentNumber,
    ...data,
    decidedBy: options.session.uid,
    decidedAt: new Date().toISOString(),
    signature: electronicSignature(options.session, "disposition", data.reason),
    searchIndex: searchIndex(numbered.documentNumber, data.batchNumber),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(QC_COLLECTIONS.dispositions, id, record, { exists: false })];
  if (data.manufacturingOrderId) {
    const order = await readMasterDocument(PRODUCTION_COLLECTIONS.orders, data.manufacturingOrderId, options.idToken);
    if (order) {
      const qcStatus = data.disposition === "approved_for_qa" ? "completed" : data.disposition === "failed" ? "failed" : "pending";
      const moStatus = data.disposition === "approved_for_qa" ? "qa_pending" : text(order.status);
      writes.push(
        writeOf(PRODUCTION_COLLECTIONS.orders, data.manufacturingOrderId, {
          ...order,
          status: moStatus,
          qcStatus,
          qaStatus: data.disposition === "approved_for_qa" ? "pending" : order.qaStatus,
          ...actorStamp(options.session, order),
        })
      );
    }
  }
  if (data.inventoryBatchId) {
    const batch = await readMasterDocument("inventoryBatches", data.inventoryBatchId, options.idToken);
    if (batch) {
      writes.push(
        writeOf("inventoryBatches", data.inventoryBatchId, {
          ...batch,
          qcStatus: data.disposition === "approved_for_qa" ? "completed" : data.disposition === "failed" ? "failed" : "pending",
          qaStatus: data.disposition === "approved_for_qa" ? "pending" : batch.qaStatus,
          qualityStatus: batch.qualityStatus,
          ...actorStamp(options.session, batch),
        })
      );
    }
  }
  await commitWrites(writes, options.idToken);
  await auditQc(options.idToken, options.session, {
    action: "QC_DISPOSITION_CHANGED",
    resource: QC_COLLECTIONS.dispositions,
    resourceId: id,
    description: `QC disposition ${data.disposition}. Inventory was not released.`,
    newData: { disposition: data.disposition },
    reason: data.reason,
  });
  if (data.disposition === "approved_for_qa") {
    await notifyQc(options.idToken, options.session, {
      type: "qa_pending",
      title: "QA pending",
      message: `QC approved ${data.batchNumber || "a batch"} for QA decision. No inventory release was performed.`,
      resource: QC_COLLECTIONS.dispositions,
      resourceId: id,
      audienceRoles: ["qa", "qc"],
    });
    try {
      if (data.manufacturingOrderId) {
        const { createBatchReviewFromManufacturing } = await import("@/lib/qa/server");
        const order = await readMasterDocument(PRODUCTION_COLLECTIONS.orders, data.manufacturingOrderId, options.idToken);
        if (order) {
          await createBatchReviewFromManufacturing({
            order: { ...order, id: data.manufacturingOrderId },
            session: options.session,
            idToken: options.idToken,
          });
        }
      }
    } catch {
      await notifyQc(options.idToken, options.session, {
        type: "qa_pending",
        title: "QA review pending",
        message: `Open the QA review from Quality Assurance if it was not generated for ${data.batchNumber || "this batch"}.`,
        resource: QC_COLLECTIONS.dispositions,
        resourceId: id,
        audienceRoles: ["qa"],
      });
    }
  }
  return { id, record };
}

export async function createInstrument(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcInstrument:create");
  const data = parseOrFail(instrumentSchema, options.payload);
  const id = crypto.randomUUID();
  const record = { instrumentId: id, ...data, searchIndex: searchIndex(data.instrumentCode, data.instrumentName), ...actorStamp(options.session) };
  await commitWrites([writeOf(QC_COLLECTIONS.instruments, id, record, { exists: false })], options.idToken);
  await auditQc(options.idToken, options.session, {
    action: "INSTRUMENT_UPDATED",
    resource: QC_COLLECTIONS.instruments,
    resourceId: id,
    description: `Created instrument ${data.instrumentCode}.`,
    newData: { instrumentCode: data.instrumentCode },
  });
  return { id, record };
}

export async function createStandard(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcReferenceStandard:create");
  const data = parseOrFail(standardSchema, options.payload);
  const id = crypto.randomUUID();
  const record = { standardId: id, ...data, searchIndex: searchIndex(data.standardCode, data.name), ...actorStamp(options.session) };
  await commitWrites([writeOf(QC_COLLECTIONS.standards, id, record, { exists: false })], options.idToken);
  await auditQc(options.idToken, options.session, {
    action: "REFERENCE_STANDARD_UPDATED",
    resource: QC_COLLECTIONS.standards,
    resourceId: id,
    description: `Created reference standard ${data.standardCode}.`,
  });
  return { id, record };
}

export async function createStabilityStudy(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcStability:create");
  const data = parseOrFail(stabilitySchema, options.payload);
  await requireRecord("products", data.productId, options.idToken, "Product");
  const id = crypto.randomUUID();
  const numbered = await issueQcNumber("STB", options.session, options.idToken);
  const points = data.timepoints?.length ? data.timepoints : ["initial", "1_month", "3_month", "6_month", "12_month"];
  const writes: AtomicWrite[] = [];
  for (const point of points) {
    const pointId = crypto.randomUUID();
    writes.push(
      writeOf(
        QC_COLLECTIONS.timepoints,
        pointId,
        { timepointId: pointId, stabilityStudyId: id, timepoint: point, status: "planned", ...actorStamp(options.session) },
        { exists: false }
      )
    );
  }
  const record = {
    stabilityStudyId: id,
    studyNumber: numbered.documentNumber,
    ...data,
    status: "active",
    searchIndex: searchIndex(numbered.documentNumber, data.productId, data.batchNumber),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(QC_COLLECTIONS.stability, id, record, { exists: false }));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function saveQcDocument(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qcTest:update");
  const data = parseOrFail(qcDocumentSchema, options.payload);
  const id = crypto.randomUUID();
  const record = { documentId: id, ...data, ...actorStamp(options.session) };
  await commitWrites([writeOf(QC_COLLECTIONS.documents, id, record, { exists: false })], options.idToken);
  return { id, record };
}
