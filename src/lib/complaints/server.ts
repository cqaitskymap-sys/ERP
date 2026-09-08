import { searchIndex } from "@/lib/inventory/keys";
import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import { COMPLAINT_COLLECTIONS } from "@/lib/complaints/collections";
import { calculateComplaintDueDate } from "@/lib/complaints/sla";
import {
  actorStamp,
  assertOpen,
  auditComplaint,
  calculateRiskScore,
  commitWrites,
  electronicSignature,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueComplaintNumber,
  notifyComplaint,
  parseOrFail,
  preventSelfApproval,
  requireRecord,
  reuseIdempotent,
  riskLevelFromScore,
  text,
  workflowFail,
  writeOf,
} from "@/lib/complaints/helpers";
import {
  COMMUNICATION_TRANSITIONS,
  COMPLAINT_TRANSITIONS,
  INVESTIGATION_TRANSITIONS,
  NOTIFICATION_TRANSITIONS,
  RECALL_TRANSITIONS,
  SAMPLE_TRANSITIONS,
  TASK_TRANSITIONS,
  WITHDRAWAL_TRANSITIONS,
  canTransition,
} from "@/lib/complaints/status";
import { queryMasterDocuments, readMasterDocument } from "@/lib/masters/firestore";
import {
  categorySchema,
  communicationSchema,
  complaintSchema,
  investigationSchema,
  investigationTaskSchema,
  investigatorSchema,
  linkSchema,
  qaDecisionSchema,
  recallBatchSchema,
  recallCustomerSchema,
  recallReturnSchema,
  recallSchema,
  regulatoryNotificationSchema,
  riskAssessmentSchema,
  rootCauseSchema,
  sampleSchema,
  sampleTransferSchema,
  slaRuleSchema,
  withdrawalSchema,
} from "@/lib/validation/complaints";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";

export {
  COMMUNICATION_TRANSITIONS,
  COMPLAINT_TRANSITIONS,
  INVESTIGATION_TRANSITIONS,
  NOTIFICATION_TRANSITIONS,
  RECALL_TRANSITIONS,
  SAMPLE_TRANSITIONS,
  TASK_TRANSITIONS,
  WITHDRAWAL_TRANSITIONS,
};

function complaintSearch(record: Record<string, unknown>) {
  return searchIndex(
    record.complaintNumber,
    record.customerId,
    record.productId,
    record.batchNumber,
    record.category,
    record.severity,
    record.status,
    record.marketId,
    record.assignedTo
  );
}

export async function createComplaint(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintIntake:create");
  const data = parseOrFail(complaintSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  if (data.customerId) {
    const customer = await readMasterDocument("customers", data.customerId, options.idToken);
    if (!customer) fail("Customer was not found. Use Customer Master — do not create a duplicate.");
  }
  const product = await readMasterDocument("products", data.productId, options.idToken);
  if (!product) fail("Product was not found. Use Product Master — do not create a duplicate.");
  const sla = data.slaRuleId
    ? await readMasterDocument(COMPLAINT_COLLECTIONS.sla, data.slaRuleId, options.idToken)
    : null;
  const dates = calculateComplaintDueDate(data.receivedDate || new Date().toISOString(), sla || undefined);
  const numbered = await issueComplaintNumber("CMP", options.session, options.idToken);
  const id = crypto.randomUUID();
  const batchLookup = data.batchNumber ? await lookupComplaintBatch(data.batchNumber, options.idToken) : { found: false };
  const record: Record<string, unknown> = {
    complaintId: id,
    complaintNumber: numbered.documentNumber,
    receivedDate: data.receivedDate || new Date().toISOString(),
    receivedBy: options.session.uid,
    status: "received",
    sourceType: data.sourceType,
    customerId: data.customerId || "",
    contactReference: data.contactReference || "",
    country: data.country || "",
    marketId: data.marketId || "",
    productId: data.productId,
    productCode: text(product.productCode || product.code),
    productName: text(product.productName || product.name),
    dosageForm: text(product.dosageForm),
    strength: text(product.strength),
    manufacturingSite: text(product.manufacturingSite || product.site),
    batchNumber: data.batchNumber || "",
    batchFound: batchLookup.found,
    batchMessage: batchLookup.found ? "" : data.batchNumber ? "Batch Not Found — Investigation Required" : "",
    complaintDescription: data.complaintDescription,
    urgency: data.urgency,
    initialAssessment: data.initialAssessment || "",
    category: data.category || "",
    severity: data.severity || "",
    assignedTo: data.assignedTo || "",
    attachments: data.attachments || "",
    slaRuleId: data.slaRuleId || "",
    dueDate: dates.dueDate,
    acknowledgementDueDate: dates.acknowledgementDueDate,
    triageDueDate: dates.triageDueDate,
    investigationDueDate: dates.investigationDueDate,
    qaReviewDueDate: dates.qaReviewDueDate,
    customerResponseDueDate: dates.customerResponseDueDate,
    slaTimezone: dates.timezone,
    capaId: "",
    changeControlId: "",
    pvCaseId: "",
    potentialAdverseEvent: false,
    ...actorStamp(options.session),
  };
  record.searchIndex = complaintSearch(record);
  const writes = [writeOf(COMPLAINT_COLLECTIONS.complaints, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "COMPLAINT_CREATED",
    resource: COMPLAINT_COLLECTIONS.complaints,
    resourceId: id,
    description: `Registered complaint ${numbered.documentNumber}.`,
    newData: { productId: data.productId, batchNumber: data.batchNumber, sourceType: data.sourceType },
  });
  await notifyComplaint(options.idToken, options.session, {
    type: data.urgency === "critical" ? "critical_complaint" : "new_complaint",
    title: data.urgency === "critical" ? "Critical complaint" : "New complaint registered",
    message: `${numbered.documentNumber} was received.`,
    resource: COMPLAINT_COLLECTIONS.complaints,
    resourceId: id,
    audienceRoles: ["qa", "regulatory"],
    severity: data.urgency === "critical" ? "critical" : "info",
  });
  return { id, record };
}

export async function updateComplaint(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintCase:update");
  const current = await requireRecord(COMPLAINT_COLLECTIONS.complaints, options.id, options.idToken, "Complaint");
  assertOpen(current.status, "complaints");
  const data = parseOrFail(complaintSchema.partial(), options.payload);
  const next: Record<string, unknown> = {
    ...current,
    ...data,
    complaintNumber: current.complaintNumber,
    complaintId: current.complaintId || options.id,
    ...actorStamp(options.session, current),
  };
  next.searchIndex = complaintSearch(next);
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.complaints, options.id, next)], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "COMPLAINT_UPDATED",
    resource: COMPLAINT_COLLECTIONS.complaints,
    resourceId: options.id,
    description: `Updated complaint ${current.complaintNumber}.`,
    oldData: { status: current.status, category: current.category, severity: current.severity },
    newData: { status: next.status, category: next.category, severity: next.severity },
  });
  return { id: options.id, record: next };
}

export async function classifyComplaint(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintCase:update");
  const current = await requireRecord(COMPLAINT_COLLECTIONS.complaints, options.id, options.idToken, "Complaint");
  assertOpen(current.status, "complaints");
  const next: Record<string, unknown> = {
    ...current,
    category: text(options.payload.category),
    severity: text(options.payload.severity) || current.severity,
    classificationConfirmedBy: options.session.uid,
    classificationConfirmedAt: new Date().toISOString(),
    ...actorStamp(options.session, current),
  };
  next.searchIndex = complaintSearch(next);
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.complaints, options.id, next)], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "COMPLAINT_CLASSIFIED",
    resource: COMPLAINT_COLLECTIONS.complaints,
    resourceId: options.id,
    description: `Classified ${current.complaintNumber} as ${next.category}.`,
    oldData: { category: current.category, severity: current.severity },
    newData: { category: next.category, severity: next.severity },
    reason: text(options.payload.reason),
  });
  return { id: options.id, record: next };
}

export async function assignComplaint(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintCase:assign");
  const current = await requireRecord(COMPLAINT_COLLECTIONS.complaints, options.id, options.idToken, "Complaint");
  assertOpen(current.status, "complaints");
  const assignedTo = text(options.payload.assignedTo);
  if (!assignedTo) fail("Assigned user is required.");
  const next: Record<string, unknown> = {
    ...current,
    assignedTo,
    assignedDate: new Date().toISOString(),
    ...actorStamp(options.session, current),
  };
  next.searchIndex = complaintSearch(next);
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.complaints, options.id, next)], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "COMPLAINT_ASSIGNED",
    resource: COMPLAINT_COLLECTIONS.complaints,
    resourceId: options.id,
    description: `Assigned ${current.complaintNumber}.`,
    oldData: { assignedTo: current.assignedTo },
    newData: { assignedTo },
  });
  await notifyComplaint(options.idToken, options.session, {
    type: "complaint_assigned",
    title: "Complaint assigned",
    message: `${current.complaintNumber} was assigned for investigation.`,
    resource: COMPLAINT_COLLECTIONS.complaints,
    resourceId: options.id,
    audienceRoles: ["qa", "department_head"],
  });
  return { id: options.id, record: next };
}

export async function createInvestigation(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintInvestigation:create");
  const data = parseOrFail(investigationSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const complaint = await requireRecord(COMPLAINT_COLLECTIONS.complaints, data.complaintId, options.idToken, "Complaint");
  assertOpen(complaint.status, "complaints");
  const numbered = await issueComplaintNumber("INV", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record: Record<string, unknown> = {
    investigationId: id,
    investigationNumber: numbered.documentNumber,
    complaintId: data.complaintId,
    complaintNumber: complaint.complaintNumber,
    initiatedDate: new Date().toISOString(),
    initiatedBy: options.session.uid,
    investigationLead: data.investigationLead || "",
    department: data.department || "",
    objective: data.objective || "",
    scope: data.scope || "",
    status: "initiated",
    dueDate: data.dueDate || complaint.investigationDueDate || "",
    conclusion: "",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.complaintId, data.investigationLead, data.department),
  };
  const complaintNext: Record<string, unknown> = {
    ...complaint,
    investigationId: id,
    status: canTransition(COMPLAINT_TRANSITIONS, text(complaint.status), "under_investigation")
      ? "under_investigation"
      : complaint.status,
    ...actorStamp(options.session, complaint),
  };
  const writes = [
    writeOf(COMPLAINT_COLLECTIONS.investigations, id, record, { exists: false }),
    writeOf(COMPLAINT_COLLECTIONS.complaints, data.complaintId, { ...complaintNext, searchIndex: complaintSearch(complaintNext) }),
  ];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "INVESTIGATION_CREATED",
    resource: COMPLAINT_COLLECTIONS.investigations,
    resourceId: id,
    description: `Opened investigation ${numbered.documentNumber}.`,
    newData: { complaintId: data.complaintId },
  });
  await notifyComplaint(options.idToken, options.session, {
    type: "investigation_assigned",
    title: "Investigation assigned",
    message: `${numbered.documentNumber} was opened for ${complaint.complaintNumber}.`,
    resource: COMPLAINT_COLLECTIONS.investigations,
    resourceId: id,
    audienceRoles: ["qa", "department_head"],
  });
  return { id, record };
}

export async function assignInvestigator(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintInvestigation:update");
  const investigation = await requireRecord(COMPLAINT_COLLECTIONS.investigations, options.id, options.idToken, "Investigation");
  if (["completed", "closed"].includes(text(investigation.status))) fail("Completed investigations cannot be modified.");
  const data = parseOrFail(investigatorSchema, options.payload);
  const memberId = crypto.randomUUID();
  const record = {
    investigatorId: memberId,
    investigationId: options.id,
    userId: data.userId,
    department: data.department,
    role: data.role || "",
    responsibility: data.responsibility || "",
    assignedDate: new Date().toISOString(),
    dueDate: data.dueDate || investigation.dueDate || "",
    status: "assigned",
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.investigators, memberId, record, { exists: false })], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "INVESTIGATION_TASK_ASSIGNED",
    resource: COMPLAINT_COLLECTIONS.investigators,
    resourceId: memberId,
    description: `Assigned investigator to ${investigation.investigationNumber}.`,
    newData: { userId: data.userId, department: data.department },
  });
  return { id: memberId, record };
}

export async function createInvestigationTask(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintInvestigation:update");
  const data = parseOrFail(investigationTaskSchema, options.payload);
  const investigation = await requireRecord(COMPLAINT_COLLECTIONS.investigations, data.investigationId, options.idToken, "Investigation");
  if (["completed", "closed"].includes(text(investigation.status))) fail("Completed investigations cannot be modified.");
  const id = crypto.randomUUID();
  const record = {
    taskId: id,
    investigationId: data.investigationId,
    assignedTo: data.assignedTo || "",
    department: data.department || "",
    taskType: data.taskType || "",
    description: data.description,
    dueDate: data.dueDate || "",
    priority: data.priority || "medium",
    evidence: data.evidence || "",
    response: "",
    status: "assigned",
    ...actorStamp(options.session),
    searchIndex: searchIndex(data.investigationId, data.assignedTo, data.description),
  };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.tasks, id, record, { exists: false })], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "INVESTIGATION_TASK_ASSIGNED",
    resource: COMPLAINT_COLLECTIONS.tasks,
    resourceId: id,
    description: `Assigned investigation task on ${investigation.investigationNumber}.`,
    newData: { assignedTo: data.assignedTo },
  });
  if (data.assignedTo) {
    await notifyComplaint(options.idToken, options.session, {
      type: "investigation_task_assigned",
      title: "Investigation task assigned",
      message: data.description,
      resource: COMPLAINT_COLLECTIONS.tasks,
      resourceId: id,
      audienceRoles: ["qa", "department_head"],
    });
  }
  return { id, record };
}

export async function completeInvestigationTask(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintInvestigation:complete");
  const task = await requireRecord(COMPLAINT_COLLECTIONS.tasks, options.id, options.idToken, "Investigation task");
  if (!canTransition(TASK_TRANSITIONS, text(task.status), "completed")) workflowFail(text(task.status), "completed");
  const next: Record<string, unknown> = {
    ...task,
    response: text(options.payload.response) || task.response,
    evidence: text(options.payload.evidence) || task.evidence,
    status: "completed",
    completionDate: new Date().toISOString(),
    completionSignature: electronicSignature(options.session, "task_complete", text(options.payload.reason)),
    ...actorStamp(options.session, task),
  };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.tasks, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function registerComplaintSample(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintSample:create");
  const data = parseOrFail(sampleSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireRecord(COMPLAINT_COLLECTIONS.complaints, data.complaintId, options.idToken, "Complaint");
  const numbered = await issueComplaintNumber("SMP", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    sampleId: id,
    sampleNumber: numbered.documentNumber,
    complaintId: data.complaintId,
    receivedDate: data.receivedDate || new Date().toISOString(),
    receivedFrom: data.receivedFrom || "",
    quantity: data.quantity || "",
    condition: data.condition || "",
    storageCondition: data.storageCondition || "",
    sampleLocation: data.sampleLocation || "",
    testRequired: data.testRequired || "",
    qcTestRequestId: data.qcTestRequestId || "",
    status: data.status || "received",
    chainOfCustody: [{ from: data.receivedFrom || "source", to: options.session.uid, date: new Date().toISOString(), user: options.session.uid, location: data.sampleLocation || "", reason: "Sample received" }],
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.complaintId, data.receivedFrom),
  };
  const writes = [writeOf(COMPLAINT_COLLECTIONS.samples, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "SAMPLE_RECEIVED",
    resource: COMPLAINT_COLLECTIONS.samples,
    resourceId: id,
    description: `Logged sample ${numbered.documentNumber}.`,
    newData: { complaintId: data.complaintId },
  });
  return { id, record };
}

export async function transferComplaintSample(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintSample:update");
  const sample = await requireRecord(COMPLAINT_COLLECTIONS.samples, options.id, options.idToken, "Sample");
  if (text(sample.status) === "disposed") fail("Disposed samples cannot be transferred.");
  const data = parseOrFail(sampleTransferSchema, options.payload);
  const transferId = crypto.randomUUID();
  const transfer = {
    transferId,
    sampleId: options.id,
    from: data.from,
    to: data.to,
    date: new Date().toISOString(),
    user: options.session.uid,
    location: data.location || "",
    reason: data.reason,
    ...actorStamp(options.session),
  };
  const chain = Array.isArray(sample.chainOfCustody) ? [...sample.chainOfCustody] : [];
  chain.push({ from: data.from, to: data.to, date: transfer.date, user: options.session.uid, location: data.location || "", reason: data.reason });
  const next: Record<string, unknown> = {
    ...sample,
    sampleLocation: data.location || sample.sampleLocation,
    chainOfCustody: chain,
    ...actorStamp(options.session, sample),
  };
  await commitWrites([
    writeOf(COMPLAINT_COLLECTIONS.transfers, transferId, transfer, { exists: false }),
    writeOf(COMPLAINT_COLLECTIONS.samples, options.id, next),
  ], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "SAMPLE_TRANSFERRED",
    resource: COMPLAINT_COLLECTIONS.samples,
    resourceId: options.id,
    description: `Transferred sample ${sample.sampleNumber}.`,
    oldData: { location: sample.sampleLocation },
    newData: { location: next.sampleLocation, to: data.to },
    reason: data.reason,
  });
  return { id: options.id, record: next, extra: { transfer } };
}

export async function createRootCause(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintRootCause:create");
  const data = parseOrFail(rootCauseSchema, options.payload);
  const investigation = await requireRecord(COMPLAINT_COLLECTIONS.investigations, data.investigationId, options.idToken, "Investigation");
  if (["completed", "closed"].includes(text(investigation.status))) fail("Completed investigations cannot be modified.");
  const id = crypto.randomUUID();
  const record = {
    rootCauseId: id,
    investigationId: data.investigationId,
    complaintId: investigation.complaintId,
    method: data.method || "5_why",
    category: data.category || "",
    description: data.description,
    evidence: data.evidence || "",
    conclusion: data.conclusion,
    determinedBy: options.session.uid,
    determinedDate: new Date().toISOString(),
    confidence: data.confidence || "",
    status: "draft",
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.rootCauses, id, record, { exists: false })], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "ROOT_CAUSE_ADDED",
    resource: COMPLAINT_COLLECTIONS.rootCauses,
    resourceId: id,
    description: `Recorded root cause on ${investigation.investigationNumber}.`,
    newData: { method: record.method, category: record.category },
  });
  return { id, record };
}

export async function createRiskAssessment(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintRiskAssessment:create");
  const data = parseOrFail(riskAssessmentSchema, options.payload);
  await requireRecord(COMPLAINT_COLLECTIONS.complaints, data.complaintId, options.idToken, "Complaint");
  const formula = data.formula || "severity * occurrence * detectability";
  const riskScore = calculateRiskScore(data.severity, data.occurrence, data.detectability, formula);
  const riskLevel = riskLevelFromScore(riskScore);
  const id = crypto.randomUUID();
  const record = {
    riskAssessmentId: id,
    complaintId: data.complaintId,
    method: data.method || "configurable_matrix",
    formula,
    severity: data.severity,
    occurrence: data.occurrence,
    detectability: data.detectability,
    riskScore,
    riskLevel,
    rationale: data.rationale,
    assessedBy: options.session.uid,
    assessmentDate: new Date().toISOString(),
    status: "draft",
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.risks, id, record, { exists: false })], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "RISK_ASSESSMENT_CREATED",
    resource: COMPLAINT_COLLECTIONS.risks,
    resourceId: id,
    description: `Recorded complaint risk ${riskLevel} (${riskScore}).`,
    newData: { riskScore, riskLevel, formula },
  });
  if (riskLevel === "high" || riskLevel === "critical") {
    await notifyComplaint(options.idToken, options.session, {
      type: "high_risk_complaint",
      title: "High-risk complaint",
      message: `Risk ${riskLevel} recorded for a complaint.`,
      resource: COMPLAINT_COLLECTIONS.risks,
      resourceId: id,
      audienceRoles: ["qa", "regulatory"],
      severity: "warning",
    });
  }
  return { id, record };
}

export async function approveQAComplaintDecision(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintCase:close");
  const data = parseOrFail(qaDecisionSchema, options.payload);
  const complaint = await requireRecord(COMPLAINT_COLLECTIONS.complaints, options.id, options.idToken, "Complaint");
  assertOpen(complaint.status, "complaints");
  preventSelfApproval(options.session, complaint.createdBy);
  const next: Record<string, unknown> = {
    ...complaint,
    qaDecision: data.decision,
    qaDecisionRationale: data.rationale,
    qaDecisionBy: options.session.uid,
    qaDecisionDate: new Date().toISOString(),
    qaDecisionSignature: electronicSignature(options.session, "qa_decision", data.rationale),
    status: canTransition(COMPLAINT_TRANSITIONS, text(complaint.status), "customer_response_pending")
      ? "customer_response_pending"
      : complaint.status,
    ...actorStamp(options.session, complaint),
  };
  next.searchIndex = complaintSearch(next);
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.complaints, options.id, next)], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "QA_DECISION_RECORDED",
    resource: COMPLAINT_COLLECTIONS.complaints,
    resourceId: options.id,
    description: `QA decision ${data.decision} on ${complaint.complaintNumber}.`,
    oldData: { qaDecision: complaint.qaDecision },
    newData: { qaDecision: data.decision },
    reason: data.rationale,
  });
  return { id: options.id, record: next };
}

export async function createCustomerCommunication(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintCommunication:create");
  const data = parseOrFail(communicationSchema, options.payload);
  const complaint = await requireRecord(COMPLAINT_COLLECTIONS.complaints, data.complaintId, options.idToken, "Complaint");
  const id = crypto.randomUUID();
  const record = {
    communicationId: id,
    complaintId: data.complaintId,
    customerId: data.customerId || complaint.customerId || "",
    communicationType: data.communicationType,
    date: new Date().toISOString(),
    subject: data.subject,
    summary: data.summary || "",
    response: data.response || "",
    attachment: data.attachment || "",
    responsiblePerson: options.session.uid,
    approvalStatus: "draft",
    status: "draft",
    ...actorStamp(options.session),
    searchIndex: searchIndex(data.complaintId, data.subject, data.communicationType),
  };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.communications, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function approveCustomerCommunication(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintCommunication:approve");
  const comm = await requireRecord(COMPLAINT_COLLECTIONS.communications, options.id, options.idToken, "Communication");
  preventSelfApproval(options.session, comm.createdBy);
  if (!canTransition(COMMUNICATION_TRANSITIONS, text(comm.status), "approved")) workflowFail(text(comm.status), "approved");
  const next: Record<string, unknown> = {
    ...comm,
    status: "approved",
    approvalStatus: "approved",
    approvalSignature: electronicSignature(options.session, "communication_approve", text(options.payload.reason)),
    ...actorStamp(options.session, comm),
  };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.communications, options.id, next)], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "CUSTOMER_RESPONSE_APPROVED",
    resource: COMPLAINT_COLLECTIONS.communications,
    resourceId: options.id,
    description: `Approved customer communication ${comm.subject}.`,
    reason: text(options.payload.reason),
  });
  return { id: options.id, record: next };
}

export async function createRecall(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintRecall:create");
  const data = parseOrFail(recallSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  if (data.complaintId) await requireRecord(COMPLAINT_COLLECTIONS.complaints, data.complaintId, options.idToken, "Complaint");
  const product = await readMasterDocument("products", data.productId, options.idToken);
  if (!product) fail("Product was not found.");
  const numbered = await issueComplaintNumber("REC", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record: Record<string, unknown> = {
    recallId: id,
    recallNumber: numbered.documentNumber,
    complaintId: data.complaintId || "",
    productId: data.productId,
    productName: text(product.productName || product.name),
    reason: data.reason,
    riskAssessment: data.riskAssessment || "",
    recallClass: data.recallClass,
    markets: data.markets || "",
    initiationDate: "",
    owner: options.session.uid,
    status: "potential",
    autonomousDecision: false,
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.productId, data.complaintId, data.recallClass),
  };
  const writes = [writeOf(COMPLAINT_COLLECTIONS.recalls, id, record, { exists: false })];
  if (data.complaintId) {
    const complaint = await requireRecord(COMPLAINT_COLLECTIONS.complaints, data.complaintId, options.idToken, "Complaint");
    const complaintNext: Record<string, unknown> = {
      ...complaint,
      recallId: id,
      status: canTransition(COMPLAINT_TRANSITIONS, text(complaint.status), "recall_assessment")
        ? "recall_assessment"
        : complaint.status,
      ...actorStamp(options.session, complaint),
    };
    writes.push(writeOf(COMPLAINT_COLLECTIONS.complaints, data.complaintId, { ...complaintNext, searchIndex: complaintSearch(complaintNext) }));
  }
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "RECALL_CREATED",
    resource: COMPLAINT_COLLECTIONS.recalls,
    resourceId: id,
    description: `Opened potential recall ${numbered.documentNumber}.`,
    newData: { productId: data.productId, recallClass: data.recallClass },
  });
  await notifyComplaint(options.idToken, options.session, {
    type: "recall_approval_pending",
    title: "Recall approval pending",
    message: `${numbered.documentNumber} requires authorized review. The system did not decide a recall.`,
    resource: COMPLAINT_COLLECTIONS.recalls,
    resourceId: id,
    audienceRoles: ["qa", "regulatory", "management"],
    severity: "warning",
  });
  return { id, record };
}

export async function approveRecall(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintRecall:approve");
  const recall = await requireRecord(COMPLAINT_COLLECTIONS.recalls, options.id, options.idToken, "Recall");
  preventSelfApproval(options.session, recall.createdBy);
  if (!canTransition(RECALL_TRANSITIONS, text(recall.status), "initiated") && text(recall.status) !== "regulatory_review") {
    if (!canTransition(RECALL_TRANSITIONS, text(recall.status), "management_approval")
      && !canTransition(RECALL_TRANSITIONS, text(recall.status), "regulatory_review")
      && !canTransition(RECALL_TRANSITIONS, text(recall.status), "initiated")) {
      workflowFail(text(recall.status), "approve");
    }
  }
  const nextStatus = text(recall.status) === "regulatory_review" ? "initiated" : text(recall.status) === "management_approval" ? "regulatory_review" : text(recall.status) === "qa_review" ? "management_approval" : "qa_review";
  if (!canTransition(RECALL_TRANSITIONS, text(recall.status), nextStatus)) workflowFail(text(recall.status), nextStatus);
  const next: Record<string, unknown> = {
    ...recall,
    status: nextStatus,
    initiationDate: nextStatus === "initiated" ? new Date().toISOString() : recall.initiationDate,
    approvalSignature: electronicSignature(options.session, `recall_${nextStatus}`, text(options.payload.reason)),
    ...actorStamp(options.session, recall),
  };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.recalls, options.id, next)], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "RECALL_APPROVED",
    resource: COMPLAINT_COLLECTIONS.recalls,
    resourceId: options.id,
    description: `Recall ${recall.recallNumber} moved to ${nextStatus}.`,
    oldData: { status: recall.status },
    newData: { status: nextStatus },
    reason: text(options.payload.reason),
  });
  return { id: options.id, record: next };
}

export async function addRecallBatch(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintRecall:update");
  const recall = await requireRecord(COMPLAINT_COLLECTIONS.recalls, options.id, options.idToken, "Recall");
  if (text(recall.status) === "closed") fail("Closed recalls cannot be modified.");
  const data = parseOrFail(recallBatchSchema, options.payload);
  const batch = await lookupComplaintBatch(data.batchNumber, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    recallBatchId: id,
    recallId: options.id,
    batchNumber: data.batchNumber,
    batchFound: batch.found,
    batchMessage: batch.found ? "" : "Batch Not Found — Investigation Required",
    affectedQuantity: data.affectedQuantity || "",
    releasedQuantity: data.releasedQuantity || "",
    distributedQuantity: data.distributedQuantity || "",
    returnedQuantity: "0",
    remainingQuantity: data.distributedQuantity || "",
    reconciledQuantity: "0",
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.recallBatches, id, record, { exists: false })], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "RECALL_CUSTOMER_ADDED",
    resource: COMPLAINT_COLLECTIONS.recallBatches,
    resourceId: id,
    description: `Identified affected batch ${data.batchNumber} on ${recall.recallNumber}.`,
    newData: { batchNumber: data.batchNumber },
  });
  return { id, record };
}

export async function addRecallCustomer(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintRecall:update");
  const recall = await requireRecord(COMPLAINT_COLLECTIONS.recalls, options.id, options.idToken, "Recall");
  if (text(recall.status) === "closed") fail("Closed recalls cannot be modified.");
  const data = parseOrFail(recallCustomerSchema, options.payload);
  const customer = await readMasterDocument("customers", data.customerId, options.idToken);
  if (!customer) fail("Customer was not found. Use Customer Master.");
  const id = crypto.randomUUID();
  const record = {
    recallCustomerId: id,
    recallId: options.id,
    customerId: data.customerId,
    customerName: text(customer.customerName || customer.name),
    productId: recall.productId,
    batchNumber: data.batchNumber || "",
    quantity: data.quantity || "",
    shipmentDate: data.shipmentDate || "",
    marketId: data.marketId || "",
    confirmed: true,
    status: "identified",
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.recallCustomers, id, record, { exists: false })], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "RECALL_CUSTOMER_ADDED",
    resource: COMPLAINT_COLLECTIONS.recallCustomers,
    resourceId: id,
    description: `Confirmed affected customer on ${recall.recallNumber}.`,
    newData: { customerId: data.customerId },
  });
  return { id, record };
}

export async function recordRecallReturn(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintRecall:update");
  const recall = await requireRecord(COMPLAINT_COLLECTIONS.recalls, options.id, options.idToken, "Recall");
  if (text(recall.status) === "closed") fail("Closed recalls cannot be modified.");
  const data = parseOrFail(recallReturnSchema, options.payload);
  const id = crypto.randomUUID();
  const shipped = Number(data.quantityShipped || 0);
  const returned = Number(data.quantityReturned || 0);
  const record = {
    recallReturnId: id,
    recallId: options.id,
    customerId: data.customerId || "",
    batchNumber: data.batchNumber || "",
    quantityShipped: data.quantityShipped || "",
    quantityReturned: data.quantityReturned || "",
    quantityPending: String(Math.max(shipped - returned, 0)),
    returnDate: data.returnDate || new Date().toISOString(),
    condition: data.condition || "",
    location: data.location || "",
    disposition: data.disposition || "",
    status: returned <= 0 ? "pending" : shipped > 0 && returned >= shipped ? "complete" : "partial",
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.recallReturns, id, record, { exists: false })], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "RECALL_RETURN_RECORDED",
    resource: COMPLAINT_COLLECTIONS.recallReturns,
    resourceId: id,
    description: `Recorded recall return on ${recall.recallNumber}.`,
    newData: { quantityReturned: data.quantityReturned },
  });
  return { id, record };
}

export async function reconcileRecall(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintRecall:close");
  const recall = await requireRecord(COMPLAINT_COLLECTIONS.recalls, options.id, options.idToken, "Recall");
  if (!canTransition(RECALL_TRANSITIONS, text(recall.status), "effectiveness_check") && text(recall.status) !== "reconciliation") {
    workflowFail(text(recall.status), "reconcile");
  }
  const next: Record<string, unknown> = {
    ...recall,
    status: "effectiveness_check",
    reconciledAt: new Date().toISOString(),
    reconciliationNotes: text(options.payload.reason),
    ...actorStamp(options.session, recall),
  };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.recalls, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function createWithdrawal(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintWithdrawal:create");
  const data = parseOrFail(withdrawalSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const numbered = await issueComplaintNumber("WDR", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    withdrawalId: id,
    withdrawalNumber: numbered.documentNumber,
    complaintId: data.complaintId || "",
    productId: data.productId,
    reason: data.reason,
    classification: data.classification || "",
    markets: data.markets || "",
    status: "proposed",
    initiationDate: new Date().toISOString(),
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.productId, data.classification),
  };
  const writes = [writeOf(COMPLAINT_COLLECTIONS.withdrawals, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "WITHDRAWAL_CREATED",
    resource: COMPLAINT_COLLECTIONS.withdrawals,
    resourceId: id,
    description: `Proposed withdrawal ${numbered.documentNumber}.`,
    newData: { productId: data.productId },
  });
  return { id, record };
}

export async function approveWithdrawal(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintWithdrawal:approve");
  const withdrawal = await requireRecord(COMPLAINT_COLLECTIONS.withdrawals, options.id, options.idToken, "Withdrawal");
  preventSelfApproval(options.session, withdrawal.createdBy);
  if (!canTransition(WITHDRAWAL_TRANSITIONS, text(withdrawal.status), "approved")) workflowFail(text(withdrawal.status), "approved");
  const next: Record<string, unknown> = {
    ...withdrawal,
    status: "approved",
    approvalSignature: electronicSignature(options.session, "withdrawal_approve", text(options.payload.reason)),
    ...actorStamp(options.session, withdrawal),
  };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.withdrawals, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function createRegulatoryNotification(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintRegulatory:create");
  const data = parseOrFail(regulatoryNotificationSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const numbered = await issueComplaintNumber("CRN", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    notificationId: id,
    notificationNumber: numbered.documentNumber,
    complaintId: data.complaintId || "",
    recallId: data.recallId || "",
    authorityId: data.authorityId || "",
    marketId: data.marketId || "",
    subject: data.subject,
    summary: data.summary || "",
    status: "assessment_pending",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.authorityId, data.subject),
  };
  const writes = [writeOf(COMPLAINT_COLLECTIONS.notifications, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "REGULATORY_NOTIFICATION_CREATED",
    resource: COMPLAINT_COLLECTIONS.notifications,
    resourceId: id,
    description: `Prepared regulatory assessment ${numbered.documentNumber}.`,
    newData: { authorityId: data.authorityId },
  });
  return { id, record };
}

export async function approveRegulatoryNotification(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintRegulatory:approve");
  const note = await requireRecord(COMPLAINT_COLLECTIONS.notifications, options.id, options.idToken, "Regulatory notification");
  preventSelfApproval(options.session, note.createdBy);
  if (["submitted", "acknowledged", "closed"].includes(text(note.status))) fail("Submitted regulatory notifications cannot be altered.");
  if (!canTransition(NOTIFICATION_TRANSITIONS, text(note.status), "approved")) workflowFail(text(note.status), "approved");
  const next: Record<string, unknown> = {
    ...note,
    status: "approved",
    approvalSignature: electronicSignature(options.session, "regulatory_approve", text(options.payload.reason)),
    ...actorStamp(options.session, note),
  };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.notifications, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function linkCAPA(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintCase:update");
  const data = parseOrFail(linkSchema, options.payload);
  if (!data.capaId) fail("CAPA id is required.");
  const capa = await readMasterDocument("qaCAPA", data.capaId, options.idToken);
  if (!capa) fail("CAPA was not found. Use the existing CAPA engine.");
  const complaint = await requireRecord(COMPLAINT_COLLECTIONS.complaints, options.id, options.idToken, "Complaint");
  assertOpen(complaint.status, "complaints");
  const next: Record<string, unknown> = { ...complaint, capaId: data.capaId, ...actorStamp(options.session, complaint) };
  next.searchIndex = complaintSearch(next);
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.complaints, options.id, next)], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: "CAPA_LINKED",
    resource: COMPLAINT_COLLECTIONS.complaints,
    resourceId: options.id,
    description: `Linked CAPA ${capa.capaNumber || data.capaId} to ${complaint.complaintNumber}.`,
    newData: { capaId: data.capaId },
  });
  return { id: options.id, record: next };
}

export async function linkChangeControl(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintCase:update");
  const data = parseOrFail(linkSchema, options.payload);
  if (!data.changeControlId) fail("Change control id is required.");
  const change = await readMasterDocument("qaChangeControls", data.changeControlId, options.idToken);
  if (!change) fail("Change control was not found.");
  const complaint = await requireRecord(COMPLAINT_COLLECTIONS.complaints, options.id, options.idToken, "Complaint");
  assertOpen(complaint.status, "complaints");
  const next: Record<string, unknown> = { ...complaint, changeControlId: data.changeControlId, ...actorStamp(options.session, complaint) };
  next.searchIndex = complaintSearch(next);
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.complaints, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function linkPVCase(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaintCase:update");
  const data = parseOrFail(linkSchema, options.payload);
  if (!data.pvCaseId) fail("PV case id is required.");
  const pvCase = await readMasterDocument("pvCases", data.pvCaseId, options.idToken);
  if (!pvCase) fail("PV case was not found. Use the existing PV module.");
  const complaint = await requireRecord(COMPLAINT_COLLECTIONS.complaints, options.id, options.idToken, "Complaint");
  assertOpen(complaint.status, "complaints");
  const next: Record<string, unknown> = {
    ...complaint,
    pvCaseId: data.pvCaseId,
    potentialAdverseEvent: true,
    ...actorStamp(options.session, complaint),
  };
  next.searchIndex = complaintSearch(next);
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.complaints, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function createCategory(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaints:update");
  const data = parseOrFail(categorySchema, options.payload);
  const id = crypto.randomUUID();
  const record = { ...data, status: data.status || "active", ...actorStamp(options.session), searchIndex: searchIndex(data.categoryCode, data.categoryName) };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.categories, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createSlaRule(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "complaints:update");
  const data = parseOrFail(slaRuleSchema, options.payload);
  const id = crypto.randomUUID();
  const record = { ...data, status: data.status || "active", ...actorStamp(options.session), searchIndex: searchIndex(data.name) };
  await commitWrites([writeOf(COMPLAINT_COLLECTIONS.sla, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function lookupComplaintBatch(batchNumber: string, idToken: string) {
  if (!batchNumber.trim()) return { found: false, message: "Batch Not Found — Investigation Required" };
  const rows = await queryMasterDocuments(INVENTORY_COLLECTIONS.batches, idToken, {
    filters: [{ field: "batchNumber", value: batchNumber.trim() }],
    limit: 5,
  }).catch(() => []);
  if (!rows.length) return { found: false, message: "Batch Not Found — Investigation Required" };
  return { found: true, batch: rows[0] };
}

export async function findRelatedComplaints(query: { productId?: string; batchNumber?: string; customerId?: string; category?: string; excludeId?: string }, idToken: string) {
  const filters = [];
  if (query.productId) filters.push({ field: "productId", value: query.productId });
  else if (query.batchNumber) filters.push({ field: "batchNumber", value: query.batchNumber });
  else if (query.customerId) filters.push({ field: "customerId", value: query.customerId });
  if (!filters.length) return [];
  const rows = await queryMasterDocuments(COMPLAINT_COLLECTIONS.complaints, idToken, { filters, limit: 15 });
  return rows.filter((row) => {
    if (query.excludeId && row.id === query.excludeId) return false;
    const batchMatch = !query.batchNumber || text(row.batchNumber) === query.batchNumber;
    const categoryMatch = !query.category || text(row.category) === query.category;
    return batchMatch && categoryMatch;
  });
}

export async function identifyAffectedCustomers(productId: string, batchNumber: string, idToken: string) {
  const complaints = batchNumber
    ? await queryMasterDocuments(COMPLAINT_COLLECTIONS.complaints, idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 50 }).catch(() => [])
    : await queryMasterDocuments(COMPLAINT_COLLECTIONS.complaints, idToken, { filters: [{ field: "productId", value: productId }], limit: 50 }).catch(() => []);
  const issues = await queryMasterDocuments(INVENTORY_COLLECTIONS.issues, idToken, {
    filters: productId ? [{ field: "productId", value: productId }] : [],
    limit: 50,
  }).catch(() => []);
  return {
    fromComplaints: complaints.filter((row) => text(row.customerId)),
    fromShipments: issues,
    note: "Confirm affected customers. Inventory quantities are not edited from this view.",
  };
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
  if (["closed", "submitted"].includes(text(record.status))) fail(`${options.label} in "${record.status}" cannot be modified.`);
  const next = { ...record, ...options.payload, complaintNumber: record.complaintNumber, investigationNumber: record.investigationNumber, sampleNumber: record.sampleNumber, recallNumber: record.recallNumber, withdrawalNumber: record.withdrawalNumber, notificationNumber: record.notificationNumber, ...actorStamp(options.session, record) };
  await commitWrites([writeOf(options.collection, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function advanceComplaintRecord(options: {
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
  if (options.next === "closed") next.closureDate = new Date().toISOString();
  if (options.collection === COMPLAINT_COLLECTIONS.complaints) next.searchIndex = complaintSearch(next);
  await commitWrites([writeOf(options.collection, options.id, next)], options.idToken);
  await auditComplaint(options.idToken, options.session, {
    action: options.audit || `${options.label.toUpperCase().replace(/\s+/g, "_")}_UPDATED`,
    resource: options.collection,
    resourceId: options.id,
    description: `${options.label} moved to ${options.next}.`,
    oldData: { status: record.status },
    newData: { status: options.next },
    reason: options.comment || "",
  });
  return { id: options.id, record: next };
}
