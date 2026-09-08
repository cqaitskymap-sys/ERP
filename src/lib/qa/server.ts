import { searchIndex } from "@/lib/inventory/keys";
import { transitionQuality } from "@/lib/inventory/server";
import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";
import { canTransition as canMoTransition, MO_TRANSITIONS } from "@/lib/production/status";
import { QC_COLLECTIONS } from "@/lib/qc/collections";
import { assertSeparationOfDuties, loadWorkflowConfig } from "@/lib/qa/approvals";
import { QA_COLLECTIONS } from "@/lib/qa/collections";
import { DEFAULT_QA_CHECKLIST } from "@/lib/qa/config";
import {
  actorStamp,
  auditQa,
  commitWrites,
  electronicSignature,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueQaNumber,
  listByField,
  notifyQa,
  parseOrFail,
  requireRecord,
  reuseIdempotent,
  text,
  workflowFail,
  writeOf,
} from "@/lib/qa/helpers";
import { validateBatchForRelease } from "@/lib/qa/release-validation";
import {
  canTransition,
  CAPA_TRANSITIONS,
  CHANGE_TRANSITIONS,
  DEVIATION_TRANSITIONS,
  DOCUMENT_TRANSITIONS,
  REVIEW_TRANSITIONS,
} from "@/lib/qa/status";
import { queryMasterDocuments, readMasterDocument, type AtomicWrite } from "@/lib/masters/firestore";
import {
  batchReviewSchema,
  capaSchema,
  changeControlSchema,
  checklistItemUpdateSchema,
  deviationSchema,
  dispositionSchema,
  documentReviewSchema,
} from "@/lib/validation/qa";
import type { SessionPayload } from "@/types/auth";

export async function loadBatchDossier(options: {
  manufacturingOrderId?: string;
  batchNumber?: string;
  idToken: string;
}) {
  const orderId = text(options.manufacturingOrderId);
  const batchNumber = text(options.batchNumber);
  const order = orderId
    ? await readMasterDocument(PRODUCTION_COLLECTIONS.orders, orderId, options.idToken)
    : (
        await queryMasterDocuments(PRODUCTION_COLLECTIONS.orders, options.idToken, {
          filters: batchNumber ? [{ field: "batchNumber", value: batchNumber }] : [],
          limit: 1,
        })
      )[0];
  const resolvedBatch = batchNumber || text(order?.batchNumber);
  const resolvedOrderId = orderId || text(order?.id);
  const [bmrs, dispensing, ipc, yields, recons, prodDevs, samples, tests, oos, oot, coas, qaDevs] = await Promise.all([
    resolvedOrderId ? listByField(PRODUCTION_COLLECTIONS.bmrs, "manufacturingOrderId", resolvedOrderId, options.idToken) : Promise.resolve([]),
    resolvedOrderId ? listByField(PRODUCTION_COLLECTIONS.dispensing, "manufacturingOrderId", resolvedOrderId, options.idToken) : Promise.resolve([]),
    resolvedOrderId ? listByField(PRODUCTION_COLLECTIONS.ipc, "manufacturingOrderId", resolvedOrderId, options.idToken) : Promise.resolve([]),
    resolvedOrderId ? listByField(PRODUCTION_COLLECTIONS.yields, "manufacturingOrderId", resolvedOrderId, options.idToken) : Promise.resolve([]),
    resolvedOrderId ? listByField(PRODUCTION_COLLECTIONS.reconciliations, "manufacturingOrderId", resolvedOrderId, options.idToken) : Promise.resolve([]),
    resolvedBatch ? listByField(PRODUCTION_COLLECTIONS.deviations, "batchNumber", resolvedBatch, options.idToken) : Promise.resolve([]),
    resolvedBatch ? listByField(QC_COLLECTIONS.samples, "batchNumber", resolvedBatch, options.idToken) : Promise.resolve([]),
    resolvedBatch ? listByField(QC_COLLECTIONS.tests, "batchNumber", resolvedBatch, options.idToken) : Promise.resolve([]),
    resolvedBatch ? listByField(QC_COLLECTIONS.oos, "batchNumber", resolvedBatch, options.idToken) : Promise.resolve([]),
    resolvedBatch ? listByField(QC_COLLECTIONS.oot, "batchNumber", resolvedBatch, options.idToken) : Promise.resolve([]),
    resolvedBatch ? listByField(QC_COLLECTIONS.coas, "batchNumber", resolvedBatch, options.idToken) : Promise.resolve([]),
    resolvedBatch ? listByField(QA_COLLECTIONS.deviations, "batchNumber", resolvedBatch, options.idToken) : Promise.resolve([]),
  ]);
  const bmr = bmrs[0] || null;
  const ipcRows = ipc.length || !bmr ? ipc : await listByField(PRODUCTION_COLLECTIONS.ipc, "bmrId", String(bmr.id), options.idToken);
  const [steps, equipment, operators, bomItems, mappings] = await Promise.all([
    bmr ? listByField(PRODUCTION_COLLECTIONS.steps, "bmrId", String(bmr.id), options.idToken) : Promise.resolve([]),
    resolvedOrderId ? listByField(PRODUCTION_COLLECTIONS.equipmentAssignments, "manufacturingOrderId", resolvedOrderId, options.idToken) : Promise.resolve([]),
    resolvedOrderId ? listByField(PRODUCTION_COLLECTIONS.operatorAssignments, "manufacturingOrderId", resolvedOrderId, options.idToken) : Promise.resolve([]),
    order?.bomId ? listByField(PRODUCTION_COLLECTIONS.bomItems, "bomId", text(order.bomId), options.idToken) : Promise.resolve([]),
    order?.customerId && order?.productId
      ? queryMasterDocuments("productCustomerMappings", options.idToken, {
          filters: [
            { field: "customerId", value: text(order.customerId) },
            { field: "productId", value: text(order.productId) },
          ],
          limit: 5,
        })
      : Promise.resolve([]),
  ]);
  return {
    order,
    bmr,
    steps,
    dispensing,
    ipc: ipcRows,
    yields,
    reconciliations: recons,
    equipment,
    operators,
    bomItems,
    productionDeviations: prodDevs,
    deviations: qaDevs,
    samples,
    tests,
    oos,
    oot,
    coas,
    customerRequirements: mappings,
  };
}

export async function evaluateRelease(options: {
  manufacturingOrderId?: string;
  batchNumber?: string;
  checklist?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  idToken: string;
}) {
  const dossier = await loadBatchDossier(options);
  return {
    dossier,
    validation: validateBatchForRelease({
      order: dossier.order,
      bmr: dossier.bmr,
      reconciliations: dossier.reconciliations,
      ipc: dossier.ipc,
      tests: dossier.tests,
      oos: dossier.oos,
      oot: dossier.oot,
      deviations: [...dossier.productionDeviations, ...dossier.deviations],
      checklist: options.checklist,
      documents: options.documents,
      coas: dossier.coas,
    }),
  };
}

export async function createBatchReview(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
  systemGenerated?: boolean;
}) {
  if (!options.systemGenerated) ensurePermission(options.session, "qaBatchReview:update");
  const data = parseOrFail(batchReviewSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const order = await requireRecord(PRODUCTION_COLLECTIONS.orders, data.manufacturingOrderId, options.idToken, "Manufacturing order");
  const existing = await queryMasterDocuments(QA_COLLECTIONS.reviews, options.idToken, {
    filters: [{ field: "manufacturingOrderId", value: data.manufacturingOrderId }],
    limit: 1,
  });
  if (existing.length) return { id: String(existing[0].id), record: existing[0] };
  const id = crypto.randomUUID();
  const numbered = await issueQaNumber("REVIEW", options.session, options.idToken);
  const checklist = (data.checklist?.length ? data.checklist : DEFAULT_QA_CHECKLIST).map((item) => ({
    item: item.item,
    mandatory: item.mandatory !== false,
  }));
  const writes: AtomicWrite[] = [];
  const items = checklist.map((item, index) => {
    const itemId = crypto.randomUUID();
    const record = {
      itemId,
      reviewId: id,
      sequence: index + 1,
      item: item.item,
      mandatory: item.mandatory,
      status: "pending",
      reviewer: "",
      reviewedAt: "",
      comment: "",
      evidenceReference: "",
      ...actorStamp(options.session),
    };
    writes.push(writeOf(QA_COLLECTIONS.reviewItems, itemId, record, { exists: false }));
    return record;
  });
  const record = {
    reviewId: id,
    reviewNumber: numbered.documentNumber,
    manufacturingOrderId: data.manufacturingOrderId,
    batchNumber: data.batchNumber || text(order.batchNumber),
    productId: data.productId || text(order.productId),
    customerId: data.customerId || text(order.customerId),
    plantId: data.plantId || text(order.plantId),
    bomId: text(order.bomId),
    priority: data.priority,
    dueDate: data.dueDate || "",
    qcCompletedAt: data.qcCompletedAt || (options.systemGenerated ? new Date().toISOString() : ""),
    status: "pending_review",
    remarks: data.remarks || "",
    searchIndex: searchIndex(numbered.documentNumber, order.batchNumber, order.productId, order.customerId),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(QA_COLLECTIONS.reviews, id, record, { exists: false }));
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditQa(options.idToken, options.session, {
    action: "QA_REVIEW_CREATED",
    resource: QA_COLLECTIONS.reviews,
    resourceId: id,
    description: `Opened QA review ${numbered.documentNumber} for batch ${text(record.batchNumber)}.`,
    newData: { status: "pending_review" },
  });
  await notifyQa(options.idToken, options.session, {
    type: "qa_review_pending",
    title: "QA review pending",
    message: `Batch ${text(record.batchNumber)} is ready for QA.`,
    resource: QA_COLLECTIONS.reviews,
    resourceId: id,
    audienceRoles: ["qa"],
  });
  return { id, record, items };
}

export async function createBatchReviewFromManufacturing(options: {
  order: Record<string, unknown> & { id?: string };
  session: SessionPayload;
  idToken: string;
}) {
  const orderId = String(options.order.id || "");
  if (!orderId) return null;
  return createBatchReview({
    payload: {
      manufacturingOrderId: orderId,
      batchNumber: text(options.order.batchNumber),
      productId: text(options.order.productId),
      customerId: text(options.order.customerId),
      plantId: text(options.order.plantId),
      remarks: "Opened automatically when QC approved the batch for QA.",
      idempotencyKey: `qa-review-mo-${orderId}`,
    },
    session: options.session,
    idToken: options.idToken,
    systemGenerated: true,
  });
}

export async function startBatchReview(options: { id: string; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qaBatchReview:update");
  const record = await requireRecord(QA_COLLECTIONS.reviews, options.id, options.idToken, "QA review");
  if (!canTransition(REVIEW_TRANSITIONS, text(record.status), "under_review")) workflowFail(text(record.status), "start");
  const next = {
    ...record,
    status: "under_review",
    startedBy: options.session.uid,
    startedAt: new Date().toISOString(),
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(QA_COLLECTIONS.reviews, options.id, next)], options.idToken);
  await auditQa(options.idToken, options.session, {
    action: "QA_REVIEW_STARTED",
    resource: QA_COLLECTIONS.reviews,
    resourceId: options.id,
    description: `Started QA review ${text(record.reviewNumber)}.`,
    oldData: { status: record.status },
    newData: { status: "under_review" },
  });
  return { id: options.id, record: next };
}

export async function updateChecklistItem(options: {
  id: string;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "qaBatchReview:update");
  const review = await requireRecord(QA_COLLECTIONS.reviews, options.id, options.idToken, "QA review");
  if (["released", "rejected", "closed"].includes(text(review.status))) fail("Approved QA decisions cannot be modified.");
  const data = parseOrFail(checklistItemUpdateSchema, options.payload);
  const item = await requireRecord(QA_COLLECTIONS.reviewItems, data.itemId, options.idToken, "Checklist item");
  if (text(item.reviewId) !== options.id) fail("Checklist item does not belong to this review.");
  const next = {
    ...item,
    status: data.status,
    comment: data.comment || "",
    evidenceReference: data.evidenceReference || "",
    reviewer: options.session.uid,
    reviewedAt: new Date().toISOString(),
    ...actorStamp(options.session, item),
  };
  await commitWrites([writeOf(QA_COLLECTIONS.reviewItems, data.itemId, next)], options.idToken);
  await auditQa(options.idToken, options.session, {
    action: "CHECKLIST_UPDATED",
    resource: QA_COLLECTIONS.reviewItems,
    resourceId: data.itemId,
    description: `Updated checklist item ${text(item.item)}.`,
    oldData: { status: item.status },
    newData: { status: data.status },
  });
  return { id: data.itemId, record: next };
}

export async function completeBatchReview(options: { id: string; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qaBatchReview:approve");
  const record = await requireRecord(QA_COLLECTIONS.reviews, options.id, options.idToken, "QA review");
  if (!canTransition(REVIEW_TRANSITIONS, text(record.status), "review_complete") && text(record.status) !== "under_review") {
    workflowFail(text(record.status), "complete");
  }
  const next = {
    ...record,
    status: "decision_pending",
    completedBy: options.session.uid,
    completedAt: new Date().toISOString(),
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(QA_COLLECTIONS.reviews, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

async function applyInventoryQuality(options: {
  batchNumber: string;
  nextQualityStatus: "approved" | "blocked" | "rejected";
  reason: string;
  session: SessionPayload;
  idToken: string;
}) {
  const balances = await queryMasterDocuments(INVENTORY_COLLECTIONS.balances, options.idToken, {
    filters: [{ field: "batchNumber", value: options.batchNumber }],
    limit: 50,
  });
  for (const balance of balances) {
    const current = text(balance.qualityStatus);
    if (current === options.nextQualityStatus) continue;
    let from = current;
    if (options.nextQualityStatus === "approved" && from === "quarantine") {
      await transitionQuality({
        payload: { balanceId: String(balance.id), nextQualityStatus: "under_testing", reason: options.reason, quantity: Number(balance.availableQuantity || 0) },
        session: options.session,
        idToken: options.idToken,
      });
      from = "under_testing";
    }
    if (from === options.nextQualityStatus) continue;
    await transitionQuality({
      payload: {
        balanceId: String(balance.id),
        nextQualityStatus: options.nextQualityStatus,
        reason: options.reason,
        quantity: Number(balance.availableQuantity || 0),
      },
      session: options.session,
      idToken: options.idToken,
    });
  }
}

async function applyOrderDisposition(options: {
  order: Record<string, unknown> & { id?: string };
  nextStatus: "released" | "held" | "rejected";
  session: SessionPayload;
  idToken: string;
}) {
  const orderId = String(options.order.id || "");
  if (!orderId) return;
  const current = text(options.order.status);
  if (current === options.nextStatus) return;
  if (!canMoTransition(MO_TRANSITIONS, current, options.nextStatus) && current !== "held") {
    if (!(current === "held" && options.nextStatus !== "held")) fail(`Manufacturing order cannot move from ${current} to ${options.nextStatus}.`);
  }
  await commitWrites(
    [
      writeOf(PRODUCTION_COLLECTIONS.orders, orderId, {
        ...options.order,
        status: options.nextStatus,
        qaStatus: options.nextStatus,
        ...actorStamp(options.session, options.order),
      }),
    ],
    options.idToken
  );
}

export async function decideBatch(options: {
  id: string;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  const data = parseOrFail(dispositionSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey || `qa-${data.decision}-${options.id}`, options.idToken);
  if (reused) return reused;
  const review = await requireRecord(QA_COLLECTIONS.reviews, options.id, options.idToken, "QA review");
  if (["released", "rejected", "closed"].includes(text(review.status))) {
    fail("This batch already has a final QA decision.");
  }
  const nextStatus =
    data.decision === "release" ? "released" : data.decision === "hold" ? "held" : data.decision === "reject" ? "rejected" : "";
  if (nextStatus && !canTransition(REVIEW_TRANSITIONS, text(review.status), nextStatus)) {
    fail(`Cannot ${data.decision} a batch in "${text(review.status)}" status. Complete the review first.`);
  }
  const items = await listByField(QA_COLLECTIONS.reviewItems, "reviewId", options.id, options.idToken);
  const documents = await listByField(QA_COLLECTIONS.documents, "sourceRecordId", options.id, options.idToken);
  const evaluated = await evaluateRelease({
    manufacturingOrderId: text(review.manufacturingOrderId),
    batchNumber: text(review.batchNumber),
    checklist: items,
    documents,
    idToken: options.idToken,
  });
  const dossier = evaluated.dossier;
  const workflow = await loadWorkflowConfig("qa_batch_release", options.idToken);
  const qcApprover = dossier.tests.find((row) => text(row.approvedBy))?.approvedBy;
  const qcAnalyst = dossier.tests.find((row) => text(row.analystId))?.analystId;
  if (data.decision === "release") {
    ensurePermission(options.session, "qaBatchRelease:approve");
    assertSeparationOfDuties({
      session: options.session,
      manufacturedBy: text(dossier.order?.completedBy || dossier.order?.createdBy),
      qcAnalystId: text(qcAnalyst),
      qcApproverId: text(qcApprover),
      allowSelfApproval: workflow.allowSelfApproval,
    });
    if (!evaluated.validation.eligible) fail(evaluated.validation.blockers[0] || "Batch is not eligible for release.");
    await applyInventoryQuality({
      batchNumber: text(review.batchNumber),
      nextQualityStatus: "approved",
      reason: data.reason,
      session: options.session,
      idToken: options.idToken,
    });
    if (dossier.order) {
      await applyOrderDisposition({
        order: dossier.order,
        nextStatus: "released",
        session: options.session,
        idToken: options.idToken,
      });
    }
    return finalizeDecision({
      review,
      id: options.id,
      decision: "release",
      nextStatus: "released",
      data,
      session: options.session,
      idToken: options.idToken,
      collection: QA_COLLECTIONS.dispositions,
      series: "DISP",
      action: "BATCH_RELEASED",
      notifyType: "batch_released",
      title: "Batch released",
    });
  }
  if (data.decision === "hold") {
    ensurePermission(options.session, "qaBatchHold:approve");
    await applyInventoryQuality({
      batchNumber: text(review.batchNumber),
      nextQualityStatus: "blocked",
      reason: data.reason,
      session: options.session,
      idToken: options.idToken,
    });
    if (dossier.order) {
      await applyOrderDisposition({
        order: dossier.order,
        nextStatus: "held",
        session: options.session,
        idToken: options.idToken,
      });
    }
    return finalizeDecision({
      review,
      id: options.id,
      decision: "hold",
      nextStatus: "held",
      data,
      session: options.session,
      idToken: options.idToken,
      collection: QA_COLLECTIONS.holds,
      series: "HOLD",
      action: "BATCH_HELD",
      notifyType: "batch_held",
      title: "Batch held",
    });
  }
  if (data.decision === "reject") {
    ensurePermission(options.session, "qaBatchReject:approve");
    await applyInventoryQuality({
      batchNumber: text(review.batchNumber),
      nextQualityStatus: "rejected",
      reason: data.reason,
      session: options.session,
      idToken: options.idToken,
    });
    if (dossier.order) {
      await applyOrderDisposition({
        order: dossier.order,
        nextStatus: "rejected",
        session: options.session,
        idToken: options.idToken,
      });
    }
    return finalizeDecision({
      review,
      id: options.id,
      decision: "reject",
      nextStatus: "rejected",
      data,
      session: options.session,
      idToken: options.idToken,
      collection: QA_COLLECTIONS.rejections,
      series: "REJ",
      action: "BATCH_REJECTED",
      notifyType: "batch_rejected",
      title: "Batch rejected",
    });
  }
  fail("Unsupported QA decision.");
}

async function finalizeDecision(options: {
  review: Record<string, unknown>;
  id: string;
  decision: string;
  nextStatus: string;
  data: { reason: string; comments?: string; effectiveDate?: string; holdReason?: string; rejectionCategory?: string; idempotencyKey?: string };
  session: SessionPayload;
  idToken: string;
  collection: string;
  series: "DISP" | "HOLD" | "REJ";
  action: string;
  notifyType: string;
  title: string;
}) {
  const decisionId = crypto.randomUUID();
  const numbered = await issueQaNumber(options.series, options.session, options.idToken);
  const signature = electronicSignature(options.session, options.decision, options.data.reason);
  const decision = {
    dispositionId: decisionId,
    documentNumber: numbered.documentNumber,
    reviewId: options.id,
    batchId: text(options.review.manufacturingOrderId),
    batchNumber: text(options.review.batchNumber),
    decision: options.decision,
    reason: options.data.reason,
    holdReason: options.data.holdReason || "",
    rejectionCategory: options.data.rejectionCategory || "",
    reviewer: options.session.uid,
    reviewedAt: new Date().toISOString(),
    effectiveDate: options.data.effectiveDate || new Date().toISOString().slice(0, 10),
    comments: options.data.comments || "",
    approvalReference: signature.signatureReference,
    signature,
    searchIndex: searchIndex(numbered.documentNumber, options.review.batchNumber),
    ...actorStamp(options.session),
  };
  const nextReview = {
    ...options.review,
    status: options.nextStatus,
    decision: options.decision,
    decidedBy: options.session.uid,
    decidedAt: new Date().toISOString(),
    ...actorStamp(options.session, options.review),
  };
  const key = options.data.idempotencyKey || `qa-${options.decision}-${options.id}`;
  await commitWrites(
    [
      writeOf(options.collection, decisionId, decision, { exists: false }),
      writeOf(QA_COLLECTIONS.reviews, options.id, nextReview),
      writeOf(QA_COLLECTIONS.dispositions, decisionId, { ...decision, collection: options.collection }, { exists: false }),
      idempotencyWrite(key, { id: options.id, record: nextReview, decision }, options.session),
    ],
    options.idToken
  );
  await auditQa(options.idToken, options.session, {
    action: options.action,
    resource: QA_COLLECTIONS.reviews,
    resourceId: options.id,
    description: `${options.title} ${text(options.review.batchNumber)}.`,
    oldData: { status: options.review.status },
    newData: { status: options.nextStatus, decision: options.decision },
    reason: options.data.reason,
  });
  await notifyQa(options.idToken, options.session, {
    type: options.notifyType,
    title: options.title,
    message: `Batch ${text(options.review.batchNumber)} was ${options.decision}d.`,
    resource: QA_COLLECTIONS.reviews,
    resourceId: options.id,
    audienceRoles: ["qa", "qc", "production", "warehouse"],
  });
  return { id: options.id, record: nextReview, decision };
}

export async function releaseBatch(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  return decideBatch({ ...options, payload: { ...options.payload, decision: "release" } });
}

export async function holdBatch(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  return decideBatch({ ...options, payload: { ...options.payload, decision: "hold" } });
}

export async function rejectBatch(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  return decideBatch({ ...options, payload: { ...options.payload, decision: "reject" } });
}

export async function createDeviation(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qaDeviation:create");
  const data = parseOrFail(deviationSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = await issueQaNumber("DEV", options.session, options.idToken);
  const record = {
    deviationId: id,
    deviationNumber: numbered.documentNumber,
    ...data,
    reportedBy: options.session.uid,
    reportedAt: new Date().toISOString(),
    status: "open",
    searchIndex: searchIndex(numbered.documentNumber, data.batchNumber, data.description),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(QA_COLLECTIONS.deviations, id, record, { exists: false })], options.idToken);
  await auditQa(options.idToken, options.session, {
    action: "DEVIATION_CREATED",
    resource: QA_COLLECTIONS.deviations,
    resourceId: id,
    description: `Created deviation ${numbered.documentNumber}.`,
    newData: { severity: data.severity },
  });
  if (data.severity === "critical") {
    await notifyQa(options.idToken, options.session, {
      type: "critical_deviation",
      title: "Critical deviation",
      message: `${numbered.documentNumber} requires QA attention.`,
      resource: QA_COLLECTIONS.deviations,
      resourceId: id,
      audienceRoles: ["qa"],
    });
  }
  return { id, record };
}

export async function updateDeviation(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qaDeviation:update");
  const record = await requireRecord(QA_COLLECTIONS.deviations, options.id, options.idToken, "Deviation");
  if (text(record.status) === "closed") fail("Closed deviations cannot be edited.");
  const nextStatus = text(options.payload.status || record.status);
  if (nextStatus !== text(record.status) && !canTransition(DEVIATION_TRANSITIONS, text(record.status), nextStatus)) {
    workflowFail(text(record.status), nextStatus);
  }
  const next = { ...record, ...options.payload, status: nextStatus, ...actorStamp(options.session, record) };
  await commitWrites([writeOf(QA_COLLECTIONS.deviations, options.id, next)], options.idToken);
  await auditQa(options.idToken, options.session, {
    action: "DEVIATION_UPDATED",
    resource: QA_COLLECTIONS.deviations,
    resourceId: options.id,
    description: `Updated deviation ${text(record.deviationNumber)}.`,
    oldData: { status: record.status },
    newData: { status: nextStatus },
  });
  return { id: options.id, record: next };
}

export async function closeDeviation(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qaDeviation:close");
  const record = await requireRecord(QA_COLLECTIONS.deviations, options.id, options.idToken, "Deviation");
  if (!canTransition(DEVIATION_TRANSITIONS, text(record.status), "closed") && text(record.status) !== "effectiveness_review") {
    workflowFail(text(record.status), "close");
  }
  const next = {
    ...record,
    status: "closed",
    closedBy: options.session.uid,
    closedAt: new Date().toISOString(),
    closeComment: options.comment || "",
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(QA_COLLECTIONS.deviations, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function createCAPA(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qaCapa:create");
  const data = parseOrFail(capaSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = await issueQaNumber("CAPA", options.session, options.idToken);
  const record = {
    capaId: id,
    capaNumber: numbered.documentNumber,
    ...data,
    effectivenessCheck: "",
    status: "draft",
    searchIndex: searchIndex(numbered.documentNumber, data.sourceType, data.description),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(QA_COLLECTIONS.capas, id, record, { exists: false })], options.idToken);
  await auditQa(options.idToken, options.session, {
    action: "CAPA_CREATED",
    resource: QA_COLLECTIONS.capas,
    resourceId: id,
    description: `Created CAPA ${numbered.documentNumber}.`,
    newData: { sourceType: data.sourceType },
  });
  await notifyQa(options.idToken, options.session, {
    type: "capa_assigned",
    title: "CAPA assigned",
    message: `${numbered.documentNumber} was created.`,
    resource: QA_COLLECTIONS.capas,
    resourceId: id,
    audienceRoles: ["qa"],
  });
  return { id, record };
}

export async function approveCAPA(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qaCapa:approve");
  const record = await requireRecord(QA_COLLECTIONS.capas, options.id, options.idToken, "CAPA");
  const nextStatus = text(record.status) === "draft" ? "open" : text(record.status) === "open" ? "action_in_progress" : "effectiveness_review";
  if (!canTransition(CAPA_TRANSITIONS, text(record.status), nextStatus)) workflowFail(text(record.status), "approve");
  const next = {
    ...record,
    status: nextStatus,
    approvalSignature: electronicSignature(options.session, "capa_approve", options.comment),
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(QA_COLLECTIONS.capas, options.id, next)], options.idToken);
  await auditQa(options.idToken, options.session, {
    action: "CAPA_APPROVED",
    resource: QA_COLLECTIONS.capas,
    resourceId: options.id,
    description: `Approved CAPA ${text(record.capaNumber)}.`,
    oldData: { status: record.status },
    newData: { status: nextStatus },
  });
  return { id: options.id, record: next };
}

export async function closeCAPA(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qaCapa:close");
  const record = await requireRecord(QA_COLLECTIONS.capas, options.id, options.idToken, "CAPA");
  if (!canTransition(CAPA_TRANSITIONS, text(record.status), "closed")) workflowFail(text(record.status), "close");
  const next = {
    ...record,
    status: "closed",
    effectivenessCheck: options.comment || record.effectivenessCheck,
    closedBy: options.session.uid,
    closedAt: new Date().toISOString(),
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(QA_COLLECTIONS.capas, options.id, next)], options.idToken);
  await auditQa(options.idToken, options.session, {
    action: "CAPA_CLOSED",
    resource: QA_COLLECTIONS.capas,
    resourceId: options.id,
    description: `Closed CAPA ${text(record.capaNumber)}.`,
    oldData: { status: record.status },
    newData: { status: "closed" },
  });
  return { id: options.id, record: next };
}

export async function createChangeControl(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qaChangeControl:create");
  const data = parseOrFail(changeControlSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = await issueQaNumber("CC", options.session, options.idToken);
  const record = {
    changeControlId: id,
    changeNumber: numbered.documentNumber,
    ...data,
    status: "draft",
    searchIndex: searchIndex(numbered.documentNumber, data.title),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(QA_COLLECTIONS.changes, id, record, { exists: false })], options.idToken);
  await auditQa(options.idToken, options.session, {
    action: "CHANGE_CONTROL_CREATED",
    resource: QA_COLLECTIONS.changes,
    resourceId: id,
    description: `Created change control ${numbered.documentNumber}.`,
    newData: { changeType: data.changeType },
  });
  return { id, record };
}

export async function advanceChangeControl(options: { id: string; action: string; comment?: string; session: SessionPayload; idToken: string }) {
  const record = await requireRecord(QA_COLLECTIONS.changes, options.id, options.idToken, "Change control");
  const map: Record<string, string> = {
    submit: "submitted",
    assess: "impact_assessment",
    review: "qa_review",
    approve: "approved",
    implement: "implementation",
    verify: "verification",
    close: "closed",
    reject: "rejected",
  };
  const nextStatus = map[options.action];
  if (!nextStatus) fail("Unknown change control action.");
  if (options.action === "implement" && text(record.status) !== "approved") fail("Implementation is not allowed before approval.");
  if (!canTransition(CHANGE_TRANSITIONS, text(record.status), nextStatus)) workflowFail(text(record.status), options.action);
  if (["approve", "reject", "close"].includes(options.action)) ensurePermission(options.session, options.action === "close" ? "qaChangeControl:close" : "qaChangeControl:approve");
  else ensurePermission(options.session, "qaChangeControl:update");
  const next = {
    ...record,
    status: nextStatus,
    approvalSignature: options.action === "approve" ? electronicSignature(options.session, "change_approve", options.comment) : record.approvalSignature,
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(QA_COLLECTIONS.changes, options.id, next)], options.idToken);
  if (options.action === "approve") {
    await auditQa(options.idToken, options.session, {
      action: "CHANGE_CONTROL_APPROVED",
      resource: QA_COLLECTIONS.changes,
      resourceId: options.id,
      description: `Approved change ${text(record.changeNumber)}.`,
      oldData: { status: record.status },
      newData: { status: nextStatus },
    });
  }
  return { id: options.id, record: next };
}

export async function createDocumentReview(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qaDocumentReview:read");
  const data = parseOrFail(documentReviewSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = data.documentNumber || (await issueQaNumber("DOC", options.session, options.idToken)).documentNumber;
  const record = {
    documentReviewId: id,
    documentNumber: numbered,
    version: data.version || "1",
    ...data,
    status: data.status || "draft",
    searchIndex: searchIndex(numbered, data.title),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(QA_COLLECTIONS.documents, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function actOnDocument(options: { id: string; action: "submit" | "approve" | "reject" | "activate"; comment?: string; session: SessionPayload; idToken: string }) {
  const record = await requireRecord(QA_COLLECTIONS.documents, options.id, options.idToken, "Document");
  if (["effective", "superseded", "obsolete"].includes(text(record.status)) && options.action !== "activate") {
    fail("Approved documents cannot be modified. Create a new version.");
  }
  const nextStatus =
    options.action === "submit"
      ? "under_review"
      : options.action === "approve"
        ? "approved"
        : options.action === "activate"
          ? "effective"
          : "draft";
  if (!canTransition(DOCUMENT_TRANSITIONS, text(record.status), nextStatus) && !(options.action === "activate" && text(record.status) === "approved")) {
    workflowFail(text(record.status), options.action);
  }
  ensurePermission(options.session, options.action === "submit" ? "qaDocumentReview:read" : options.action === "reject" ? "qaDocumentReview:reject" : "qaDocumentReview:approve");
  const writes: AtomicWrite[] = [];
  if (options.action === "activate") {
    const previous = await queryMasterDocuments(QA_COLLECTIONS.documents, options.idToken, {
      filters: [{ field: "title", value: text(record.title) }],
      limit: 20,
    });
    for (const row of previous) {
      if (String(row.id) !== options.id && text(row.status) === "effective") {
        writes.push(writeOf(QA_COLLECTIONS.documents, String(row.id), { ...row, status: "superseded", ...actorStamp(options.session, row) }));
      }
    }
  }
  const next = {
    ...record,
    status: nextStatus,
    approvalSignature: options.action === "approve" ? electronicSignature(options.session, "document_approve", options.comment) : record.approvalSignature,
    ...actorStamp(options.session, record),
  };
  writes.push(writeOf(QA_COLLECTIONS.documents, options.id, next));
  await commitWrites(writes, options.idToken);
  await auditQa(options.idToken, options.session, {
    action: options.action === "activate" ? "DOCUMENT_SUPERSEDED" : "DOCUMENT_APPROVED",
    resource: QA_COLLECTIONS.documents,
    resourceId: options.id,
    description: `${options.action} document ${text(record.documentNumber)}.`,
    oldData: { status: record.status },
    newData: { status: nextStatus },
  });
  return { id: options.id, record: next };
}

export async function generateReleaseCertificate(options: { reviewId: string; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "qaReleaseCertificate:create");
  const reused = await reuseIdempotent(`qa-brc-${options.reviewId}`, options.idToken);
  if (reused) return reused;
  const review = await requireRecord(QA_COLLECTIONS.reviews, options.reviewId, options.idToken, "QA review");
  if (text(review.status) !== "released") fail("A release certificate can be generated only after QA release.");
  const existing = await listByField(QA_COLLECTIONS.certificates, "reviewId", options.reviewId, options.idToken);
  if (existing.length) return { id: String(existing[0].id), record: existing[0] };
  const dossier = await loadBatchDossier({
    manufacturingOrderId: text(review.manufacturingOrderId),
    batchNumber: text(review.batchNumber),
    idToken: options.idToken,
  });
  const id = crypto.randomUUID();
  const numbered = await issueQaNumber("BRC", options.session, options.idToken);
  const coa = dossier.coas.find((row) => text(row.status) === "approved") || dossier.coas[0];
  const record = {
    certificateId: id,
    certificateNumber: numbered.documentNumber,
    version: 1,
    reviewId: options.reviewId,
    manufacturingOrderId: review.manufacturingOrderId,
    productId: review.productId,
    customerId: review.customerId,
    batchNumber: review.batchNumber,
    manufacturingDate: dossier.order?.actualStartDate || dossier.order?.plannedStartDate || "",
    expiryDate: dossier.order?.expiryDate || "",
    batchQuantity: dossier.order?.batchSize || "",
    disposition: "release",
    coaNumber: coa?.coaNumber || "",
    approvedBy: review.decidedBy || options.session.uid,
    releaseDate: review.decidedAt || new Date().toISOString(),
    searchIndex: searchIndex(numbered.documentNumber, review.batchNumber, review.customerId),
    ...actorStamp(options.session),
  };
  await commitWrites(
    [
      writeOf(QA_COLLECTIONS.certificates, id, record, { exists: false }),
      idempotencyWrite(`qa-brc-${options.reviewId}`, { id, record }, options.session),
    ],
    options.idToken
  );
  return { id, record };
}
