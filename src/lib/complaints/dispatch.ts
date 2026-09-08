import { COMPLAINT_COLLECTIONS } from "@/lib/complaints/collections";
import { COMPLAINT_RESOURCES, type ComplaintResource } from "@/lib/complaints/http";
import { loadComplaintDetail, loadInvestigationDetail, loadRecallDetail } from "@/lib/complaints/query";
import {
  addRecallBatch,
  addRecallCustomer,
  advanceComplaintRecord,
  approveCustomerCommunication,
  approveQAComplaintDecision,
  approveRecall,
  approveRegulatoryNotification,
  approveWithdrawal,
  assignComplaint,
  assignInvestigator,
  classifyComplaint,
  completeInvestigationTask,
  COMMUNICATION_TRANSITIONS,
  COMPLAINT_TRANSITIONS,
  createCategory,
  createComplaint,
  createCustomerCommunication,
  createInvestigation,
  createInvestigationTask,
  createRecall,
  createRegulatoryNotification,
  createRiskAssessment,
  createRootCause,
  createSlaRule,
  createWithdrawal,
  INVESTIGATION_TRANSITIONS,
  linkCAPA,
  linkChangeControl,
  linkPVCase,
  NOTIFICATION_TRANSITIONS,
  RECALL_TRANSITIONS,
  reconcileRecall,
  recordRecallReturn,
  registerComplaintSample,
  SAMPLE_TRANSITIONS,
  transferComplaintSample,
  updateComplaint,
  updateMasterLike,
  WITHDRAWAL_TRANSITIONS,
} from "@/lib/complaints/server";
import { canTransition } from "@/lib/complaints/status";
import { actorStamp, auditComplaint, commitWrites, electronicSignature, ensurePermission, requireRecord, text, workflowFail, writeOf } from "@/lib/complaints/helpers";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";

export async function createComplaintRecord(resource: ComplaintResource, payload: Record<string, unknown>, session: SessionPayload, idToken: string) {
  if (resource === "cases") return createComplaint({ payload, session, idToken });
  if (resource === "categories") return createCategory({ payload, session, idToken });
  if (resource === "sla") return createSlaRule({ payload, session, idToken });
  if (resource === "investigations") return createInvestigation({ payload, session, idToken });
  if (resource === "tasks") return createInvestigationTask({ payload, session, idToken });
  if (resource === "samples") return registerComplaintSample({ payload, session, idToken });
  if (resource === "rootCauses") return createRootCause({ payload, session, idToken });
  if (resource === "risks") return createRiskAssessment({ payload, session, idToken });
  if (resource === "communications") return createCustomerCommunication({ payload, session, idToken });
  if (resource === "notifications") return createRegulatoryNotification({ payload, session, idToken });
  if (resource === "recalls") return createRecall({ payload, session, idToken });
  if (resource === "withdrawals") return createWithdrawal({ payload, session, idToken });
  throw createNamedError("ValidationError", "This complaint resource cannot be created directly.");
}

export async function loadComplaintResourceDetail(resource: ComplaintResource, id: string, _session: SessionPayload, idToken: string) {
  if (resource === "cases") return loadComplaintDetail(id, idToken);
  if (resource === "investigations") return loadInvestigationDetail(id, idToken);
  if (resource === "recalls") return loadRecallDetail(id, idToken);
  const record = await readMasterDocument(COMPLAINT_RESOURCES[resource].collection, id, idToken);
  if (!record) return null;
  return { record, extra: {} };
}

export async function runComplaintAction(
  resource: ComplaintResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  const comment = String(payload.comment || payload.reason || "");
  if (resource === "cases" && action === "update") return updateComplaint({ id, payload, session, idToken });
  if (resource === "cases" && action === "classify") return classifyComplaint({ id, payload, session, idToken });
  if (resource === "cases" && action === "assign") return assignComplaint({ id, payload, session, idToken });
  if (resource === "cases" && action === "qa_decision") return approveQAComplaintDecision({ id, payload, session, idToken });
  if (resource === "cases" && action === "link_capa") return linkCAPA({ id, payload, session, idToken });
  if (resource === "cases" && action === "link_change") return linkChangeControl({ id, payload, session, idToken });
  if (resource === "cases" && action === "link_pv") return linkPVCase({ id, payload, session, idToken });
  if (resource === "cases" && action === "close") {
    return advanceComplaintRecord({ collection: COMPLAINT_COLLECTIONS.complaints, id, next: "closed", map: COMPLAINT_TRANSITIONS, permission: "complaintCase:close", session, idToken, comment, label: "Complaint", audit: "COMPLAINT_CLOSED" });
  }
  if (resource === "cases" && action === "reopen") {
    return advanceComplaintRecord({ collection: COMPLAINT_COLLECTIONS.complaints, id, next: "reopened", map: COMPLAINT_TRANSITIONS, permission: "complaintCase:reopen", session, idToken, comment, label: "Complaint", audit: "COMPLAINT_REOPENED" });
  }
  if (resource === "cases") {
    return step(COMPLAINT_COLLECTIONS.complaints, id, action, COMPLAINT_TRANSITIONS, "complaintCase:update", session, idToken, comment, "Complaint");
  }
  if (resource === "investigations" && action === "assign_investigator") return assignInvestigator({ id, payload, session, idToken });
  if (resource === "investigations" && action === "complete") {
    return advanceComplaintRecord({ collection: COMPLAINT_COLLECTIONS.investigations, id, next: "completed", map: INVESTIGATION_TRANSITIONS, permission: "complaintInvestigation:complete", session, idToken, comment, label: "Investigation", extra: { closureDate: new Date().toISOString(), conclusion: payload.conclusion || comment } });
  }
  if (resource === "investigations") {
    return step(COMPLAINT_COLLECTIONS.investigations, id, action, INVESTIGATION_TRANSITIONS, "complaintInvestigation:update", session, idToken, comment, "Investigation", undefined, undefined, ["completed", "closed"]);
  }
  if (resource === "tasks" && action === "complete") return completeInvestigationTask({ id, payload, session, idToken });
  if (resource === "samples" && action === "transfer") return transferComplaintSample({ id, payload, session, idToken });
  if (resource === "samples") {
    return step(COMPLAINT_COLLECTIONS.samples, id, action, SAMPLE_TRANSITIONS, "complaintSample:update", session, idToken, comment, "Sample", undefined, undefined, ["disposed"]);
  }
  if (resource === "rootCauses" && action === "approve") {
    return signChild(COMPLAINT_COLLECTIONS.rootCauses, id, "complaintRootCause:approve", session, idToken, comment, "approved");
  }
  if (resource === "risks" && action === "approve") {
    return signChild(COMPLAINT_COLLECTIONS.risks, id, "complaintRiskAssessment:approve", session, idToken, comment, "approved");
  }
  if (resource === "communications" && action === "approve") return approveCustomerCommunication({ id, payload, session, idToken });
  if (resource === "communications" && action === "send") {
    return step(COMPLAINT_COLLECTIONS.communications, id, "sent", COMMUNICATION_TRANSITIONS, "complaintCommunication:send", session, idToken, comment, "Communication");
  }
  if (resource === "communications") {
    return step(COMPLAINT_COLLECTIONS.communications, id, action, COMMUNICATION_TRANSITIONS, "complaintCommunication:create", session, idToken, comment, "Communication");
  }
  if (resource === "recalls" && action === "approve") return approveRecall({ id, payload, session, idToken });
  if (resource === "recalls" && action === "add_batch") return addRecallBatch({ id, payload, session, idToken });
  if (resource === "recalls" && action === "add_customer") return addRecallCustomer({ id, payload, session, idToken });
  if (resource === "recalls" && action === "record_return") return recordRecallReturn({ id, payload, session, idToken });
  if (resource === "recalls" && action === "reconcile") return reconcileRecall({ id, payload, session, idToken });
  if (resource === "recalls" && action === "close") {
    return advanceComplaintRecord({ collection: COMPLAINT_COLLECTIONS.recalls, id, next: "closed", map: RECALL_TRANSITIONS, permission: "complaintRecall:close", session, idToken, comment, label: "Recall" });
  }
  if (resource === "recalls") {
    return step(COMPLAINT_COLLECTIONS.recalls, id, action, RECALL_TRANSITIONS, "complaintRecall:update", session, idToken, comment, "Recall", undefined, undefined, ["closed"]);
  }
  if (resource === "withdrawals" && action === "approve") return approveWithdrawal({ id, payload, session, idToken });
  if (resource === "withdrawals") {
    return step(COMPLAINT_COLLECTIONS.withdrawals, id, action, WITHDRAWAL_TRANSITIONS, "complaintWithdrawal:update", session, idToken, comment, "Withdrawal", undefined, undefined, ["closed"]);
  }
  if (resource === "notifications" && action === "approve") return approveRegulatoryNotification({ id, payload, session, idToken });
  if (resource === "notifications" && action === "submit") {
    return step(COMPLAINT_COLLECTIONS.notifications, id, "submitted", NOTIFICATION_TRANSITIONS, "complaintRegulatory:submit", session, idToken, comment, "Regulatory notification");
  }
  if (resource === "notifications") {
    return step(COMPLAINT_COLLECTIONS.notifications, id, action, NOTIFICATION_TRANSITIONS, "complaintRegulatory:update", session, idToken, comment, "Regulatory notification", undefined, undefined, ["submitted", "acknowledged", "closed"]);
  }
  if (resource === "categories" || resource === "sla") {
    return updateMasterLike({ collection: COMPLAINT_RESOURCES[resource].collection, id, permission: "complaints:update", payload, session, idToken, label: resource });
  }
  throw createNamedError("ValidationError", "Unknown complaint action.");
}

const ACTION_STATUS: Record<string, string> = {
  triage: "triage",
  investigation_pending: "investigation_pending",
  under_investigation: "under_investigation",
  qa_review: "qa_review",
  capa_pending: "capa_pending",
  recall_assessment: "recall_assessment",
  customer_response_pending: "customer_response_pending",
  closure_review: "closure_review",
  cancelled: "cancelled",
  initiated: "initiated",
  in_progress: "in_progress",
  pending_evidence: "pending_evidence",
  completed: "completed",
  received: "received",
  logged: "logged",
  under_testing: "under_testing",
  testing_complete: "testing_complete",
  retained: "retained",
  disposed: "disposed",
  review: "review",
  approved: "approved",
  sent: "sent",
  acknowledged: "acknowledged",
  assessment: "assessment",
  management_approval: "management_approval",
  regulatory_review: "regulatory_review",
  notification: "notification",
  retrieval: "retrieval",
  reconciliation: "reconciliation",
  effectiveness_check: "effectiveness_check",
  proposed: "proposed",
  customer_notification: "customer_notification",
  recovery: "recovery",
  required: "required",
  not_required: "not_required",
  preparing: "preparing",
  submitted: "submitted",
};

async function step(
  collection: string,
  id: string,
  action: string,
  map: Record<string, string[]>,
  permission: Permission,
  session: SessionPayload,
  idToken: string,
  comment: string,
  label: string,
  audit?: string,
  extra?: Record<string, unknown>,
  lockStatuses?: string[]
) {
  ensurePermission(session, permission);
  const record = await requireRecord(collection, id, idToken, label);
  if (lockStatuses?.includes(text(record.status))) {
    throw createNamedError("ValidationError", `${label} in "${record.status}" cannot be modified.`);
  }
  const nextStatus = ACTION_STATUS[action] || action;
  if (!canTransition(map, text(record.status), nextStatus)) workflowFail(text(record.status), nextStatus);
  const next: Record<string, unknown> = {
    ...record,
    ...extra,
    status: nextStatus,
    approvalSignature: electronicSignature(session, nextStatus, comment),
    ...actorStamp(session, record),
  };
  await commitWrites([writeOf(collection, id, next)], idToken);
  await auditComplaint(idToken, session, {
    action: audit || `${label.toUpperCase().replace(/\s+/g, "_")}_UPDATED`,
    resource: collection,
    resourceId: id,
    description: `${label} moved to ${nextStatus}.`,
    oldData: { status: record.status },
    newData: { status: nextStatus },
    reason: comment,
  });
  return { id, record: next };
}

async function signChild(collection: string, id: string, permission: Permission, session: SessionPayload, idToken: string, reason: string, status: string) {
  ensurePermission(session, permission);
  const record = await requireRecord(collection, id, idToken, "Record");
  const next = { ...record, status, approvalSignature: electronicSignature(session, status, reason), ...actorStamp(session, record) };
  await commitWrites([writeOf(collection, id, next)], idToken);
  return { id, record: next };
}
