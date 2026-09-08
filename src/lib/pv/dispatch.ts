import { PV_COLLECTIONS } from "@/lib/pv/collections";
import { PV_RESOURCES, type PvResource } from "@/lib/pv/http";
import { loadCaseDetail, loadProductSafety } from "@/lib/pv/query";
import {
  addCaseEvent,
  addCaseProduct,
  approveRegulatoryReport,
  assessCausality,
  assessExpectedness,
  assessSafetySignal,
  assessSeriousness,
  assignPVCase,
  CASE_TRANSITIONS,
  COMMITMENT_TRANSITIONS,
  completeFollowUp,
  completeMedicalReview,
  completePVCommitment,
  createFollowUp,
  createPVCase,
  createPVCommitment,
  createPVIntake,
  createReportingRule,
  createRetentionPolicy,
  createRegulatoryReport,
  createSafetySignal,
  FOLLOWUP_TRANSITIONS,
  INTAKE_TRANSITIONS,
  REPORT_TRANSITIONS,
  SIGNAL_TRANSITIONS,
  updateMasterLike,
  updatePVCase,
} from "@/lib/pv/server";
import { canTransition } from "@/lib/pv/status";
import {
  actorStamp,
  auditPv,
  commitWrites,
  electronicSignature,
  ensurePermission,
  requireRecord,
  workflowFail,
  writeOf,
  text,
} from "@/lib/pv/helpers";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import { hasPermission } from "@/lib/permissions/permission-service";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";

export async function createPvRecord(resource: PvResource, payload: Record<string, unknown>, session: SessionPayload, idToken: string) {
  if (resource === "intakes") return createPVIntake({ payload, session, idToken });
  if (resource === "cases") return createPVCase({ payload, session, idToken });
  if (resource === "followups") return createFollowUp({ payload, session, idToken });
  if (resource === "reports") return createRegulatoryReport({ payload, session, idToken });
  if (resource === "rules") return createReportingRule({ payload, session, idToken });
  if (resource === "signals") return createSafetySignal({ payload, session, idToken });
  if (resource === "commitments") return createPVCommitment({ payload, session, idToken });
  if (resource === "retention") return createRetentionPolicy({ payload, session, idToken });
  throw createNamedError("ValidationError", "This PV resource cannot be created directly.");
}

export async function loadPvDetail(resource: PvResource, id: string, session: SessionPayload, idToken: string) {
  if (resource === "cases") {
    return loadCaseDetail(id, idToken, hasPermission(session.permissions, "pvMedicalReview:read"));
  }
  if (resource === "reviews") {
    const review = await readMasterDocument(PV_COLLECTIONS.reviews, id, idToken);
    if (!review) return null;
    const detail = await loadCaseDetail(text(review.caseId), idToken, true);
    return { record: review, extra: detail?.extra || {} };
  }
  const record = await readMasterDocument(PV_RESOURCES[resource].collection, id, idToken);
  if (!record) return null;
  if (resource === "followups") {
    const tasks = await (await import("@/lib/pv/helpers")).listByField(PV_COLLECTIONS.followupTasks, "followUpId", id, idToken);
    return { record, extra: { tasks } };
  }
  if (resource === "signals") {
    const assessments = await (await import("@/lib/pv/helpers")).listByField(PV_COLLECTIONS.signalAssessments, "signalId", id, idToken);
    const cases = record.productId
      ? await (await import("@/lib/masters/firestore")).queryMasterDocuments(PV_COLLECTIONS.cases, idToken, { filters: [{ field: "productId", value: text(record.productId) }], limit: 20 })
      : [];
    return { record, extra: { assessments, cases, potentialOnly: true } };
  }
  return { record, extra: {} };
}

export async function runPvAction(
  resource: PvResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  const comment = String(payload.comment || payload.reason || "");
  if (resource === "cases" && action === "assign") return assignPVCase({ id, payload, session, idToken });
  if (resource === "cases" && action === "update") return updatePVCase({ id, payload, session, idToken });
  if (resource === "cases" && action === "add_product") return addCaseProduct({ id, payload, session, idToken });
  if (resource === "cases" && action === "add_event") return addCaseEvent({ id, payload, session, idToken });
  if (resource === "cases" && action === "seriousness") return assessSeriousness({ id, payload, session, idToken });
  if (resource === "cases" && action === "expectedness") return assessExpectedness({ id, payload, session, idToken });
  if (resource === "cases" && action === "causality") return assessCausality({ id, payload, session, idToken });
  if (resource === "cases" && action === "medical_review") return completeMedicalReview({ id, payload, session, idToken });
  if (resource === "cases" && action === "close") {
    return step(PV_COLLECTIONS.cases, id, "closed", CASE_TRANSITIONS, "pvCase:close", session, idToken, comment, "Safety case", "CASE_CLOSED");
  }
  if (resource === "cases" && action === "reopen") {
    return step(PV_COLLECTIONS.cases, id, "reopened", CASE_TRANSITIONS, "pvCase:reopen", session, idToken, comment, "Safety case", "CASE_REOPENED");
  }
  if (resource === "cases") {
    return step(PV_COLLECTIONS.cases, id, action, CASE_TRANSITIONS, "pvCase:update", session, idToken, comment, "Safety case");
  }
  if (resource === "intakes") {
    return step(PV_COLLECTIONS.intakes, id, action, INTAKE_TRANSITIONS, "pvIntake:update", session, idToken, comment, "Intake", action === "converted_to_case" ? undefined : "INTAKE_UPDATED");
  }
  if (resource === "followups" && action === "complete") return completeFollowUp({ id, payload, session, idToken });
  if (resource === "followups") {
    return step(PV_COLLECTIONS.followups, id, action, FOLLOWUP_TRANSITIONS, "pvFollowup:update", session, idToken, comment, "Follow-up");
  }
  if (resource === "reports" && action === "approve") return approveRegulatoryReport({ id, comment, session, idToken });
  if (resource === "reports" && action === "submit") {
    return step(PV_COLLECTIONS.reports, id, "submitted", REPORT_TRANSITIONS, "pvRegulatoryReport:submit", session, idToken, comment, "Regulatory report", "REGULATORY_REPORT_SUBMITTED", { submissionDate: new Date().toISOString() });
  }
  if (resource === "reports") {
    return step(PV_COLLECTIONS.reports, id, action, REPORT_TRANSITIONS, "pvRegulatoryReport:update", session, idToken, comment, "Regulatory report", undefined, undefined, ["submitted", "acknowledged", "closed"]);
  }
  if (resource === "signals" && action === "assess") {
    return assessSafetySignal({
      id,
      payload: {
        assessment: payload.assessment || payload.comment || payload.reason,
        rationale: payload.rationale || payload.comment || payload.reason,
        action: payload.signalAction,
        conclusion: payload.conclusion,
      },
      session,
      idToken,
    });
  }
  if (resource === "signals" && action === "close") {
    return step(PV_COLLECTIONS.signals, id, "closed", SIGNAL_TRANSITIONS, "pvSignal:close", session, idToken, comment, "Signal");
  }
  if (resource === "signals") {
    return step(PV_COLLECTIONS.signals, id, action, SIGNAL_TRANSITIONS, "pvSignal:update", session, idToken, comment, "Signal");
  }
  if (resource === "commitments" && action === "complete") return completePVCommitment({ id, comment, session, idToken });
  if (resource === "commitments") {
    return step(PV_COLLECTIONS.commitments, id, action, COMMITMENT_TRANSITIONS, "pvCommitment:update", session, idToken, comment, "Commitment");
  }
  if (resource === "rules") return updateMasterLike({ collection: PV_COLLECTIONS.rules, id, permission: "pvRegulatoryReport:update", payload, session, idToken, label: "Reporting rule" });
  throw createNamedError("ValidationError", "Unknown PV action.");
}

export async function loadProductSafetyProfile(productId: string, idToken: string) {
  return loadProductSafety(productId, idToken);
}

const ACTION_STATUS: Record<string, string> = {
  triage: "triage",
  process: "processing",
  medical: "medical_review",
  regulatory: "regulatory_review",
  report: "reporting",
  followup: "follow_up_required",
  pending_followup: "follow_up_pending",
  close: "closed",
  reopen: "reopened",
  convert: "converted_to_case",
  duplicate: "duplicate",
  invalid: "invalid",
  start: "in_progress",
  evidence: "pending_evidence",
  complete: "completed",
  receive: "received",
  review: "under_review",
  required: "required",
  not_required: "not_required",
  prepare: "preparing",
  internal: "internal_review",
  submit: "submitted",
  acknowledge: "acknowledged",
  reject: "rejected",
  screen: "screening",
  assess: "assessment",
  confirm: "confirmed",
  monitor: "monitoring",
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
  if (nextStatus === "closed" && collection === PV_COLLECTIONS.cases) next.closureDate = new Date().toISOString();
  await commitWrites([writeOf(collection, id, next)], idToken);
  await auditPv(idToken, session, {
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
