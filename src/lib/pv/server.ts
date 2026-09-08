import { searchIndex } from "@/lib/inventory/keys";
import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import { PV_COLLECTIONS } from "@/lib/pv/collections";
import { calculateCaseDueDate, calculateReportingDueDate } from "@/lib/pv/due-date";
import {
  actorStamp,
  auditPv,
  commitWrites,
  electronicSignature,
  ensurePermission,
  fail,
  idempotencyWrite,
  issuePvNumber,
  listByField,
  notifyPv,
  parseOrFail,
  requireRecord,
  reuseIdempotent,
  text,
  validateMinimumCaseInformation,
  workflowFail,
  writeOf,
} from "@/lib/pv/helpers";
import {
  CASE_TRANSITIONS,
  COMMITMENT_TRANSITIONS,
  FOLLOWUP_TRANSITIONS,
  INTAKE_TRANSITIONS,
  REPORT_TRANSITIONS,
  SIGNAL_TRANSITIONS,
  canTransition,
} from "@/lib/pv/status";
import { queryMasterDocuments, readMasterDocument } from "@/lib/masters/firestore";
import {
  caseEventSchema,
  caseProductSchema,
  caseSchema,
  causalitySchema,
  commitmentSchema,
  expectednessSchema,
  followUpSchema,
  intakeSchema,
  medicalReviewSchema,
  reportingRuleSchema,
  regulatoryReportSchema,
  retentionPolicySchema,
  seriousnessSchema,
  signalAssessmentSchema,
  signalSchema,
} from "@/lib/validation/pv";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";

function lockedCase(status: string) {
  return status === "closed";
}

export async function createPVIntake(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvIntake:create");
  const data = parseOrFail(intakeSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const numbered = await issuePvNumber("INTAKE", options.session, options.idToken);
  const record = {
    intakeId: id,
    intakeNumber: numbered.documentNumber,
    receivedDate: data.receivedDate || new Date().toISOString(),
    receivedBy: options.session.uid,
    status: data.status || "received",
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.productId, data.batchNumber, data.sourceType, data.country),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(PV_COLLECTIONS.intakes, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "INTAKE_CREATED",
    resource: PV_COLLECTIONS.intakes,
    resourceId: id,
    description: `Created intake ${numbered.documentNumber}.`,
    newData: { sourceType: data.sourceType, productId: data.productId },
  });
  return { id, record };
}

export async function createPVCase(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvCase:create");
  const data = parseOrFail(caseSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const firstProduct = data.products?.[0];
  const firstEvent = data.events?.[0];
  const minimum = validateMinimumCaseInformation({
    patientReference: data.patient?.patientReference,
    age: data.patient?.age,
    reporterType: data.reporter?.reporterType,
    productId: firstProduct?.productId || data.productId,
    eventTerm: firstEvent?.eventTerm,
    description: firstEvent?.description || data.description,
  });
  let rule: Record<string, unknown> | null = null;
  if (data.reportingRuleId) {
    rule = await readMasterDocument(PV_COLLECTIONS.rules, data.reportingRuleId, options.idToken);
  }
  const receipt = data.initialReceiptDate || data.receivedDate || new Date().toISOString();
  const due = calculateCaseDueDate(receipt, {
    id: data.reportingRuleId,
    processingWindow: Number(rule?.processingWindow || 0) || undefined,
    timezone: text(rule?.timezone),
    version: text(rule?.updatedAt || "1"),
  });
  const id = crypto.randomUUID();
  const numbered = await issuePvNumber("CASE", options.session, options.idToken);
  const product = data.productId ? await readMasterDocument("products", data.productId, options.idToken) : null;
  const record = {
    caseId: id,
    caseNumber: numbered.documentNumber,
    intakeId: data.intakeId || "",
    receivedDate: receipt,
    initialReceiptDate: receipt,
    latestReceiptDate: receipt,
    sourceType: data.sourceType || "other",
    country: data.country || "",
    marketId: data.marketId || "",
    customerId: data.customerId || "",
    productId: data.productId || firstProduct?.productId || "",
    productName: text(product?.productName),
    productCode: text(product?.productCode),
    batchNumber: data.batchNumber || firstProduct?.batchNumber || "",
    description: data.description || firstEvent?.description || "",
    eventTerm: firstEvent?.eventTerm || "",
    priority: data.priority || "medium",
    assignedTo: data.assignedTo || "",
    medicalReviewer: data.medicalReviewer || "",
    regulatoryReviewer: data.regulatoryReviewer || "",
    dueDate: data.dueDate || due.dueDate,
    dueDateCalculation: due,
    reportingRuleId: data.reportingRuleId || "",
    capaId: data.capaId || "",
    changeControlId: data.changeControlId || "",
    minimumInformation: minimum,
    seriousnessFlag: "",
    status: "new",
    searchIndex: searchIndex(numbered.documentNumber, data.productId, data.batchNumber, data.country, firstEvent?.eventTerm),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(PV_COLLECTIONS.cases, id, record, { exists: false })];
  if (data.patient) {
    const patientId = crypto.randomUUID();
    writes.push(writeOf(PV_COLLECTIONS.patients, patientId, {
      patientId, caseId: id, ...data.patient, ...actorStamp(options.session),
    }, { exists: false }));
  }
  if (data.reporter) {
    const reporterId = crypto.randomUUID();
    writes.push(writeOf(PV_COLLECTIONS.reporters, reporterId, {
      reporterId, caseId: id, ...data.reporter, ...actorStamp(options.session),
    }, { exists: false }));
  }
  for (const item of data.products || []) {
    const productId = crypto.randomUUID();
    writes.push(writeOf(PV_COLLECTIONS.products, productId, {
      caseProductId: productId, caseId: id, ...item, ...actorStamp(options.session),
    }, { exists: false }));
  }
  for (const item of data.events || []) {
    const eventId = crypto.randomUUID();
    writes.push(writeOf(PV_COLLECTIONS.events, eventId, {
      eventId, caseId: id, ...item, ...actorStamp(options.session),
    }, { exists: false }));
  }
  if (data.intakeId) {
    const intake = await readMasterDocument(PV_COLLECTIONS.intakes, data.intakeId, options.idToken);
    if (intake) {
      writes.push(writeOf(PV_COLLECTIONS.intakes, data.intakeId, {
        ...intake, status: "converted_to_case", caseId: id, ...actorStamp(options.session, intake),
      }));
    }
  }
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "CASE_CREATED",
    resource: PV_COLLECTIONS.cases,
    resourceId: id,
    description: `Created case ${numbered.documentNumber}.`,
    newData: { productId: record.productId, minimumInformation: minimum.status },
  });
  await notifyPv(options.idToken, options.session, {
    type: data.priority === "critical" || data.priority === "high" ? "high_priority_case" : "new_safety_case",
    title: data.priority === "critical" ? "Critical safety case" : "New safety case",
    message: `${numbered.documentNumber} was created. This is not a medical determination.`,
    resource: PV_COLLECTIONS.cases,
    resourceId: id,
    audienceRoles: ["regulatory", "qa"],
    severity: data.priority === "critical" ? "critical" : "info",
  });
  return { id, record, extra: { minimum } };
}

export async function assignPVCase(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvCase:assign");
  const record = await requireRecord(PV_COLLECTIONS.cases, options.id, options.idToken, "Safety case");
  if (lockedCase(text(record.status))) fail("Closed cases cannot be assigned. Reopen first.");
  const next = {
    ...record,
    assignedTo: text(options.payload.assignedTo),
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(PV_COLLECTIONS.cases, options.id, next)], options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "CASE_ASSIGNED",
    resource: PV_COLLECTIONS.cases,
    resourceId: options.id,
    description: `Assigned ${text(record.caseNumber)}.`,
    oldData: { assignedTo: record.assignedTo },
    newData: { assignedTo: next.assignedTo },
  });
  return { id: options.id, record: next };
}

export async function updatePVCase(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvCase:update");
  const record = await requireRecord(PV_COLLECTIONS.cases, options.id, options.idToken, "Safety case");
  if (lockedCase(text(record.status))) fail("Closed case history cannot be silently edited. Reopen with authorization.");
  const next: Record<string, unknown> = {
    ...record,
    ...options.payload,
    caseNumber: record.caseNumber,
    latestReceiptDate: new Date().toISOString(),
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(PV_COLLECTIONS.cases, options.id, next)], options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "CASE_UPDATED",
    resource: PV_COLLECTIONS.cases,
    resourceId: options.id,
    description: `Updated ${text(record.caseNumber)}.`,
    oldData: { status: record.status },
    newData: { status: next.status },
  });
  return { id: options.id, record: next };
}

export async function addCaseProduct(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvCase:update");
  const record = await requireRecord(PV_COLLECTIONS.cases, options.id, options.idToken, "Safety case");
  if (lockedCase(text(record.status))) fail("Closed cases cannot be modified.");
  const data = parseOrFail(caseProductSchema, options.payload);
  const productId = crypto.randomUUID();
  const product = await readMasterDocument("products", data.productId, options.idToken);
  const row = {
    caseProductId: productId,
    caseId: options.id,
    ...data,
    productName: data.productName || text(product?.productName),
    productCode: data.productCode || text(product?.productCode),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(PV_COLLECTIONS.products, productId, row, { exists: false })], options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "PRODUCT_ADDED",
    resource: PV_COLLECTIONS.products,
    resourceId: productId,
    description: `Added ${data.productRole} product to ${text(record.caseNumber)}.`,
    newData: { productId: data.productId, productRole: data.productRole },
  });
  return { id: options.id, record, extra: { product: row } };
}

export async function addCaseEvent(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvCase:update");
  const record = await requireRecord(PV_COLLECTIONS.cases, options.id, options.idToken, "Safety case");
  if (lockedCase(text(record.status))) fail("Closed cases cannot be modified.");
  const data = parseOrFail(caseEventSchema, options.payload);
  const eventId = crypto.randomUUID();
  const row = { eventId, caseId: options.id, ...data, ...actorStamp(options.session) };
  await commitWrites([
    writeOf(PV_COLLECTIONS.events, eventId, row, { exists: false }),
    writeOf(PV_COLLECTIONS.cases, options.id, { ...record, eventTerm: record.eventTerm || data.eventTerm, ...actorStamp(options.session, record) }),
  ], options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "EVENT_ADDED",
    resource: PV_COLLECTIONS.events,
    resourceId: eventId,
    description: `Added event to ${text(record.caseNumber)}.`,
    newData: { eventTerm: data.eventTerm },
  });
  return { id: options.id, record, extra: { event: row } };
}

export async function assessSeriousness(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvMedicalReview:update");
  const record = await requireRecord(PV_COLLECTIONS.cases, options.id, options.idToken, "Safety case");
  if (lockedCase(text(record.status))) fail("Closed cases cannot be assessed.");
  const data = parseOrFail(seriousnessSchema, options.payload);
  const assessmentId = crypto.randomUUID();
  const selected = data.criteria.filter((item) => item.selected);
  const row = {
    assessmentId,
    caseId: options.id,
    ...data,
    overallSerious: data.overallSerious ?? selected.length > 0,
    reviewer: options.session.uid,
    reviewDate: new Date().toISOString(),
    approvalSignature: electronicSignature(options.session, "seriousness_confirm", data.rationale),
    ...actorStamp(options.session),
  };
  await commitWrites([
    writeOf(PV_COLLECTIONS.seriousness, assessmentId, row, { exists: false }),
    writeOf(PV_COLLECTIONS.cases, options.id, {
      ...record,
      seriousnessFlag: row.overallSerious ? "serious" : "non_serious",
      ...actorStamp(options.session, record),
    }),
  ], options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "SERIOUSNESS_ASSESSED",
    resource: PV_COLLECTIONS.seriousness,
    resourceId: assessmentId,
    description: `Seriousness recorded for ${text(record.caseNumber)}. Reviewer confirmation only — not an autonomous decision.`,
    newData: { overallSerious: row.overallSerious },
    reason: data.rationale,
  });
  if (row.overallSerious) {
    await notifyPv(options.idToken, options.session, {
      type: "serious_case",
      title: "Serious case recorded",
      message: `${text(record.caseNumber)} has a reviewer-confirmed seriousness assessment.`,
      resource: PV_COLLECTIONS.cases,
      resourceId: options.id,
      audienceRoles: ["regulatory", "qa"],
      severity: "warning",
    });
  }
  return { id: options.id, record, extra: { assessment: row } };
}

export async function assessExpectedness(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvMedicalReview:update");
  const record = await requireRecord(PV_COLLECTIONS.cases, options.id, options.idToken, "Safety case");
  if (lockedCase(text(record.status))) fail("Closed cases cannot be assessed.");
  const data = parseOrFail(expectednessSchema, options.payload);
  if (data.expectedness !== "requires_review" && !text(data.referenceDocument)) {
    fail("Expectedness requires a configured reference document. The system does not decide expectedness automatically.");
  }
  const assessmentId = crypto.randomUUID();
  const row = {
    assessmentId,
    caseId: options.id,
    ...data,
    reviewer: options.session.uid,
    reviewDate: new Date().toISOString(),
    approvalSignature: electronicSignature(options.session, "expectedness_assess", data.rationale),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(PV_COLLECTIONS.expectedness, assessmentId, row, { exists: false })], options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "EXPECTEDNESS_ASSESSED",
    resource: PV_COLLECTIONS.expectedness,
    resourceId: assessmentId,
    description: `Expectedness recorded for ${text(record.caseNumber)}.`,
    newData: { expectedness: data.expectedness },
    reason: data.rationale,
  });
  return { id: options.id, record, extra: { assessment: row } };
}

export async function assessCausality(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvMedicalReview:update");
  const record = await requireRecord(PV_COLLECTIONS.cases, options.id, options.idToken, "Safety case");
  if (lockedCase(text(record.status))) fail("Closed cases cannot be assessed.");
  const data = parseOrFail(causalitySchema, options.payload);
  const assessmentId = crypto.randomUUID();
  const row = {
    assessmentId,
    caseId: options.id,
    ...data,
    reviewer: options.session.uid,
    assessmentDate: new Date().toISOString(),
    approvalSignature: electronicSignature(options.session, "causality_assess", data.rationale),
    note: "Reviewer tool only. Not an autonomous medical causality decision.",
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(PV_COLLECTIONS.causality, assessmentId, row, { exists: false })], options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "CAUSALITY_ASSESSED",
    resource: PV_COLLECTIONS.causality,
    resourceId: assessmentId,
    description: `Causality recorded for ${text(record.caseNumber)}. Qualified reviewer decision.`,
    newData: { result: data.result },
    reason: data.rationale,
  });
  return { id: options.id, record, extra: { assessment: row } };
}

export async function completeMedicalReview(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvMedicalReview:approve");
  const record = await requireRecord(PV_COLLECTIONS.cases, options.id, options.idToken, "Safety case");
  const existing = await listByField(PV_COLLECTIONS.reviews, "caseId", options.id, options.idToken);
  if (existing.some((row) => text(row.status) === "completed")) fail("Completed medical reviews cannot be modified.");
  const data = parseOrFail(medicalReviewSchema, options.payload);
  const reviewId = crypto.randomUUID();
  const nextStatus = data.requestFollowUp ? "follow_up_required" : "regulatory_review";
  if (!canTransition(CASE_TRANSITIONS, text(record.status), nextStatus) && text(record.status) !== "medical_review") {
    workflowFail(text(record.status), nextStatus);
  }
  const row = {
    reviewId,
    caseId: options.id,
    comment: data.comment,
    requestFollowUp: Boolean(data.requestFollowUp),
    status: "completed",
    reviewer: options.session.uid,
    completedAt: new Date().toISOString(),
    approvalSignature: electronicSignature(options.session, "medical_review", data.comment),
    ...actorStamp(options.session),
  };
  await commitWrites([
    writeOf(PV_COLLECTIONS.reviews, reviewId, row, { exists: false }),
    writeOf(PV_COLLECTIONS.cases, options.id, {
      ...record,
      status: text(record.status) === "medical_review" ? nextStatus : record.status,
      medicalReviewer: options.session.uid,
      medicalReviewedAt: new Date().toISOString(),
      ...actorStamp(options.session, record),
    }),
  ], options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "MEDICAL_REVIEW_COMPLETED",
    resource: PV_COLLECTIONS.reviews,
    resourceId: reviewId,
    description: `Medical review completed for ${text(record.caseNumber)}.`,
    reason: data.comment,
  });
  return { id: options.id, record, extra: { review: row } };
}

export async function createFollowUp(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvFollowup:create");
  const data = parseOrFail(followUpSchema, options.payload);
  await requireRecord(PV_COLLECTIONS.cases, data.caseId, options.idToken, "Safety case");
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const numbered = await issuePvNumber("FOLLOWUP", options.session, options.idToken);
  const record = {
    followUpId: id,
    followUpNumber: numbered.documentNumber,
    requestDate: new Date().toISOString(),
    responseDate: "",
    response: data.response || "",
    status: data.status || "requested",
    questions: data.questions || [],
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.caseId, data.requestReason),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(PV_COLLECTIONS.followups, id, record, { exists: false })];
  for (const question of data.questions || []) {
    const taskId = crypto.randomUUID();
    writes.push(writeOf(PV_COLLECTIONS.followupTasks, taskId, {
      taskId, followUpId: id, caseId: data.caseId, question, status: "open", ...actorStamp(options.session),
    }, { exists: false }));
  }
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "FOLLOW_UP_REQUESTED",
    resource: PV_COLLECTIONS.followups,
    resourceId: id,
    description: `Requested follow-up ${numbered.documentNumber}.`,
    newData: { caseId: data.caseId },
  });
  await notifyPv(options.idToken, options.session, {
    type: "follow_up_required",
    title: "Follow-up required",
    message: `${numbered.documentNumber} was requested.`,
    resource: PV_COLLECTIONS.followups,
    resourceId: id,
    audienceRoles: ["regulatory", "qa"],
  });
  return { id, record };
}

export async function completeFollowUp(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvFollowup:close");
  const record = await requireRecord(PV_COLLECTIONS.followups, options.id, options.idToken, "Follow-up");
  if (!canTransition(FOLLOWUP_TRANSITIONS, text(record.status), "closed") && text(record.status) !== "under_review" && text(record.status) !== "received") {
    workflowFail(text(record.status), "close");
  }
  const next = {
    ...record,
    response: options.payload.response || record.response,
    responseDate: record.responseDate || new Date().toISOString(),
    status: "closed",
    ...actorStamp(options.session, record),
  };
  await commitWrites([writeOf(PV_COLLECTIONS.followups, options.id, next)], options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "FOLLOW_UP_RECEIVED",
    resource: PV_COLLECTIONS.followups,
    resourceId: options.id,
    description: `Closed follow-up ${text(record.followUpNumber)}.`,
    oldData: { status: record.status },
    newData: { status: "closed" },
  });
  return { id: options.id, record: next };
}

export async function createReportingRule(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvRegulatoryReport:create");
  const data = parseOrFail(reportingRuleSchema, options.payload);
  const id = crypto.randomUUID();
  const numbered = await issuePvNumber("RULE", options.session, options.idToken);
  const record = {
    ruleId: id,
    ruleNumber: numbered.documentNumber,
    status: data.status || "active",
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.marketId, data.authorityId, data.caseType),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(PV_COLLECTIONS.rules, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createRegulatoryReport(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvRegulatoryReport:create");
  const data = parseOrFail(regulatoryReportSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const safetyCase = await requireRecord(PV_COLLECTIONS.cases, data.caseId, options.idToken, "Safety case");
  let rule: Record<string, unknown> | null = null;
  if (data.reportingRuleId) rule = await readMasterDocument(PV_COLLECTIONS.rules, data.reportingRuleId, options.idToken);
  const due = calculateReportingDueDate(new Date().toISOString(), {
    id: data.reportingRuleId,
    reportingWindow: Number(rule?.reportingWindow || 0) || undefined,
    timezone: text(rule?.timezone),
  });
  const id = crypto.randomUUID();
  const numbered = await issuePvNumber("REPORT", options.session, options.idToken);
  const record = {
    reportId: id,
    reportNumber: numbered.documentNumber,
    productId: safetyCase.productId,
    eventTerm: safetyCase.eventTerm,
    caseNumber: safetyCase.caseNumber,
    reportingDueDate: data.reportingDueDate || due.dueDate,
    dueDateCalculation: due,
    submissionDate: "",
    authorityReference: "",
    status: data.status || "assessment_pending",
    reviewer: "",
    note: "Package foundation only. Not an authority-valid submission unless validated for the jurisdiction.",
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.caseId, data.marketId),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(PV_COLLECTIONS.reports, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "REGULATORY_REPORT_CREATED",
    resource: PV_COLLECTIONS.reports,
    resourceId: id,
    description: `Created report ${numbered.documentNumber}.`,
    newData: { caseId: data.caseId },
  });
  return { id, record };
}

export async function approveRegulatoryReport(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  return advance({
    collection: PV_COLLECTIONS.reports,
    id: options.id,
    next: "approved",
    map: REPORT_TRANSITIONS,
    permission: "pvRegulatoryReport:approve",
    session: options.session,
    idToken: options.idToken,
    comment: options.comment,
    audit: "REGULATORY_REPORT_APPROVED",
    extra: { reviewer: options.session.uid },
    label: "Regulatory report",
    lockStatuses: ["submitted", "acknowledged", "closed"],
  });
}

export async function createSafetySignal(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvSignal:create");
  const data = parseOrFail(signalSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const numbered = await issuePvNumber("SIGNAL", options.session, options.idToken);
  const record = {
    signalId: id,
    signalNumber: numbered.documentNumber,
    detectedDate: data.detectedDate || new Date().toISOString(),
    assessment: "",
    status: data.status || "detected",
    potentialOnly: true,
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.productId, data.eventTerm, data.marketId),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(PV_COLLECTIONS.signals, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "SIGNAL_CREATED",
    resource: PV_COLLECTIONS.signals,
    resourceId: id,
    description: `Created potential signal ${numbered.documentNumber}. Not clinically confirmed.`,
    newData: { productId: data.productId, eventTerm: data.eventTerm },
  });
  await notifyPv(options.idToken, options.session, {
    type: "signal_review",
    title: "Potential signal requires review",
    message: `${numbered.documentNumber} is a potential signal pending qualified review.`,
    resource: PV_COLLECTIONS.signals,
    resourceId: id,
    audienceRoles: ["regulatory", "qa"],
  });
  return { id, record };
}

export async function assessSafetySignal(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvSignal:assess");
  const record = await requireRecord(PV_COLLECTIONS.signals, options.id, options.idToken, "Signal");
  const data = parseOrFail(signalAssessmentSchema, options.payload);
  const assessmentId = crypto.randomUUID();
  const row = {
    assessmentId,
    signalId: options.id,
    ...data,
    reviewer: options.session.uid,
    assessedAt: new Date().toISOString(),
    approvalSignature: electronicSignature(options.session, "signal_assess", data.rationale),
    ...actorStamp(options.session),
  };
  const nextStatus = canTransition(SIGNAL_TRANSITIONS, text(record.status), "assessment") ? "assessment" : text(record.status);
  await commitWrites([
    writeOf(PV_COLLECTIONS.signalAssessments, assessmentId, row, { exists: false }),
    writeOf(PV_COLLECTIONS.signals, options.id, {
      ...record,
      assessment: data.assessment,
      status: nextStatus,
      ...actorStamp(options.session, record),
    }),
  ], options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "SIGNAL_ASSESSED",
    resource: PV_COLLECTIONS.signals,
    resourceId: options.id,
    description: `Assessed ${text(record.signalNumber)}. Qualified reviewer only.`,
    reason: data.rationale,
  });
  return { id: options.id, record, extra: { assessment: row } };
}

export async function createPVCommitment(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pvCommitment:create");
  const data = parseOrFail(commitmentSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const numbered = await issuePvNumber("COMMITMENT", options.session, options.idToken);
  const record = {
    commitmentId: id,
    commitmentNumber: numbered.documentNumber,
    completionDate: "",
    status: data.status || "open",
    ...data,
    searchIndex: searchIndex(numbered.documentNumber, data.source, data.description),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(PV_COLLECTIONS.commitments, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditPv(options.idToken, options.session, {
    action: "COMMITMENT_CREATED",
    resource: PV_COLLECTIONS.commitments,
    resourceId: id,
    description: `Created commitment ${numbered.documentNumber}.`,
  });
  return { id, record };
}

export async function completePVCommitment(options: { id: string; comment?: string; session: SessionPayload; idToken: string }) {
  return advance({
    collection: PV_COLLECTIONS.commitments,
    id: options.id,
    next: "completed",
    map: COMMITMENT_TRANSITIONS,
    permission: "pvCommitment:close",
    session: options.session,
    idToken: options.idToken,
    comment: options.comment,
    audit: "COMMITMENT_COMPLETED",
    extra: { completionDate: new Date().toISOString() },
    label: "Commitment",
  });
}

export async function createRetentionPolicy(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "pv:update");
  const data = parseOrFail(retentionPolicySchema, options.payload);
  const id = crypto.randomUUID();
  const record = {
    policyId: id,
    status: data.status || "active",
    autoDelete: false,
    note: "Metadata only. Safety records are never automatically deleted.",
    ...data,
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(PV_COLLECTIONS.retention, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function lookupBatch(batchNumber: string, idToken: string) {
  if (!batchNumber.trim()) return { found: false, message: "Batch not found" };
  const rows = await queryMasterDocuments(INVENTORY_COLLECTIONS.batches, idToken, {
    filters: [{ field: "batchNumber", value: batchNumber.trim() }],
    limit: 5,
  });
  if (!rows.length) return { found: false, message: "Batch not found" };
  return { found: true, batch: rows[0] };
}

export async function findPotentialDuplicates(query: { productId?: string; batchNumber?: string; country?: string; eventTerm?: string; patientReference?: string }, idToken: string) {
  const filters = [];
  if (query.productId) filters.push({ field: "productId", value: query.productId });
  else if (query.batchNumber) filters.push({ field: "batchNumber", value: query.batchNumber });
  else if (query.country) filters.push({ field: "country", value: query.country });
  if (!filters.length) return [];
  const rows = await queryMasterDocuments(PV_COLLECTIONS.cases, idToken, { filters, limit: 10 });
  return rows.filter((row) => {
    const eventMatch = !query.eventTerm || text(row.eventTerm).toLowerCase() === query.eventTerm.toLowerCase();
    const batchMatch = !query.batchNumber || text(row.batchNumber) === query.batchNumber;
    return eventMatch && batchMatch;
  });
}

export async function updateMasterLike(options: {
  collection: string;
  id: string;
  permission: Permission;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
  label: string;
}) {
  ensurePermission(options.session, options.permission);
  const record = await requireRecord(options.collection, options.id, options.idToken, options.label);
  const next = { ...record, ...options.payload, ...actorStamp(options.session, record) };
  await commitWrites([writeOf(options.collection, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function advancePvRecord(options: {
  collection: string;
  id: string;
  next: string;
  map: Record<string, string[]>;
  permission: Permission;
  session: SessionPayload;
  idToken: string;
  comment?: string;
  audit?: string;
  extra?: Record<string, unknown>;
  label: string;
}) {
  return advance(options);
}

async function advance(options: {
  collection: string;
  id: string;
  next: string;
  map: Record<string, string[]>;
  permission: Permission;
  session: SessionPayload;
  idToken: string;
  comment?: string;
  audit?: string;
  extra?: Record<string, unknown>;
  label: string;
  lockStatuses?: string[];
}) {
  ensurePermission(options.session, options.permission);
  const record = await requireRecord(options.collection, options.id, options.idToken, options.label);
  if (options.lockStatuses?.includes(text(record.status))) fail(`${options.label} in "${record.status}" cannot be modified.`);
  if (!canTransition(options.map, text(record.status), options.next)) workflowFail(text(record.status), options.next);
  const next: Record<string, unknown> = {
    ...record,
    ...options.extra,
    status: options.next,
    approvalSignature: electronicSignature(options.session, options.next, options.comment),
    ...actorStamp(options.session, record),
  };
  if (options.next === "closed" && options.collection === PV_COLLECTIONS.cases) {
    next.closureDate = new Date().toISOString();
  }
  await commitWrites([writeOf(options.collection, options.id, next)], options.idToken);
  if (options.audit) {
    await auditPv(options.idToken, options.session, {
      action: options.audit,
      resource: options.collection,
      resourceId: options.id,
      description: `${options.label} moved to ${options.next}.`,
      oldData: { status: record.status },
      newData: { status: options.next },
      reason: options.comment,
    });
  }
  return { id: options.id, record: next };
}

export {
  CASE_TRANSITIONS,
  COMMITMENT_TRANSITIONS,
  FOLLOWUP_TRANSITIONS,
  INTAKE_TRANSITIONS,
  REPORT_TRANSITIONS,
  SIGNAL_TRANSITIONS,
  calculateCaseDueDate,
  calculateReportingDueDate,
  validateMinimumCaseInformation,
};
