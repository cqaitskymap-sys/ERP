import { SQ_COLLECTIONS } from "@/lib/supplier-quality/collections";
import { SQ_RESOURCES, type SqResource } from "@/lib/supplier-quality/http";
import { loadAuditDetail, loadProfileDetail } from "@/lib/supplier-quality/query";
import {
  addAuditFinding,
  addQualificationDocument,
  advanceSqRecord,
  createAgreement,
  createAudit,
  createCertificate,
  createCommunication,
  createEvaluation,
  createQualification,
  createQuestionnaire,
  createRequalification,
  createRiskAssessment,
  createSupplierChange,
  createSupplierQualityProfile,
  createSuspension,
  linkCapaOrChange,
  qualifyMaterial,
} from "@/lib/supplier-quality/server";
import {
  AUDIT_TRANSITIONS,
  CHANGE_TRANSITIONS,
  PROFILE_TRANSITIONS,
  QUALIFICATION_TRANSITIONS,
  QUESTIONNAIRE_TRANSITIONS,
  REQUAL_TRANSITIONS,
  SUSPENSION_TRANSITIONS,
} from "@/lib/supplier-quality/status";
import { electronicSignature, ensurePermission, requireRecord, text } from "@/lib/supplier-quality/helpers";
import { actorStamp, auditSq, commitWrites, writeOf } from "@/lib/supplier-quality/helpers";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";

export async function createSqRecord(resource: SqResource, payload: Record<string, unknown>, session: SessionPayload, idToken: string) {
  if (resource === "profiles") return createSupplierQualityProfile({ payload, session, idToken });
  if (resource === "risks") return createRiskAssessment({ payload, session, idToken });
  if (resource === "qualifications") return createQualification({ payload, session, idToken });
  if (resource === "documents") return addQualificationDocument({ payload, session, idToken });
  if (resource === "questionnaires") return createQuestionnaire({ payload, session, idToken });
  if (resource === "evaluations") return createEvaluation({ payload, session, idToken });
  if (resource === "materials") return qualifyMaterial({ payload, session, idToken });
  if (resource === "audits") return createAudit({ payload, session, idToken });
  if (resource === "findings") return addAuditFinding({ payload, session, idToken });
  if (resource === "certificates") return createCertificate({ payload, session, idToken });
  if (resource === "agreements") return createAgreement({ payload, session, idToken });
  if (resource === "changes") return createSupplierChange({ payload, session, idToken });
  if (resource === "suspensions") return createSuspension({ payload, session, idToken });
  if (resource === "requalifications") return createRequalification({ payload, session, idToken });
  if (resource === "communications") return createCommunication({ payload, session, idToken });
  throw createNamedError("ValidationError", "This supplier-quality resource cannot be created directly.");
}

export async function loadSqDetail(resource: SqResource, id: string, _session: SessionPayload, idToken: string) {
  if (resource === "profiles") return loadProfileDetail(id, idToken);
  if (resource === "audits") return loadAuditDetail(id, idToken);
  const record = await readMasterDocument(SQ_RESOURCES[resource].collection, id, idToken);
  if (!record) return null;
  return { record, extra: {} };
}

export async function runSqAction(
  resource: SqResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  const comment = String(payload.comment || payload.reason || "");
  if (resource === "profiles") {
    return advanceSqRecord({ collection: SQ_COLLECTIONS.profiles, id, next: ACTION_STATUS[action] || action, map: PROFILE_TRANSITIONS, permission: "supplierQuality:update", session, idToken, comment, label: "Supplier profile" });
  }
  if (resource === "risks" && action === "approve") return signChild(SQ_COLLECTIONS.risks, id, "supplierQualityRisk:approve", session, idToken, comment);
  if (resource === "qualifications" && action === "approve") {
    return advanceSqRecord({ collection: SQ_COLLECTIONS.qualifications, id, next: "approved", map: QUALIFICATION_TRANSITIONS, permission: "supplierQualityQualification:approve", session, idToken, comment, label: "Qualification", audit: "QUALIFICATION_APPROVED", extra: { decision: "approved" }, requireSod: true });
  }
  if (resource === "qualifications" && action === "reject") {
    return advanceSqRecord({ collection: SQ_COLLECTIONS.qualifications, id, next: "rejected", map: QUALIFICATION_TRANSITIONS, permission: "supplierQualityQualification:approve", session, idToken, comment, label: "Qualification", audit: "QUALIFICATION_REJECTED", extra: { decision: "rejected" }, requireSod: true });
  }
  if (resource === "qualifications") {
    return advanceSqRecord({ collection: SQ_COLLECTIONS.qualifications, id, next: ACTION_STATUS[action] || action, map: QUALIFICATION_TRANSITIONS, permission: "supplierQualityQualification:update", session, idToken, comment, label: "Qualification", lockStatuses: ["approved"] });
  }
  if (resource === "questionnaires") {
    return advanceSqRecord({ collection: SQ_COLLECTIONS.questionnaires, id, next: ACTION_STATUS[action] || action, map: QUESTIONNAIRE_TRANSITIONS, permission: action === "approved" || action === "approve" ? "supplierQualityQuestionnaire:approve" : "supplierQualityQuestionnaire:update", session, idToken, comment, label: "Questionnaire" });
  }
  if (resource === "evaluations" && action === "approve") return signChild(SQ_COLLECTIONS.evaluations, id, "supplierQualityEvaluation:approve", session, idToken, comment);
  if (resource === "audits" && action === "close") {
    return advanceSqRecord({ collection: SQ_COLLECTIONS.audits, id, next: "closed", map: AUDIT_TRANSITIONS, permission: "supplierQualityAudit:close", session, idToken, comment, label: "Audit" });
  }
  if (resource === "audits" && action === "approve") {
    return advanceSqRecord({ collection: SQ_COLLECTIONS.audits, id, next: "approved", map: AUDIT_TRANSITIONS, permission: "supplierQualityAudit:approve", session, idToken, comment, label: "Audit", requireSod: true });
  }
  if (resource === "audits" && action === "link_capa") {
    return linkCapaOrChange({ collection: SQ_COLLECTIONS.audits, id, payload, session, idToken, permission: "supplierQualityAudit:update" });
  }
  if (resource === "audits") {
    return advanceSqRecord({ collection: SQ_COLLECTIONS.audits, id, next: ACTION_STATUS[action] || action, map: AUDIT_TRANSITIONS, permission: "supplierQualityAudit:update", session, idToken, comment, label: "Audit", lockStatuses: ["closed"] });
  }
  if (resource === "certificates" && action === "approve") return signChild(SQ_COLLECTIONS.certificates, id, "supplierQualityCertificate:approve", session, idToken, comment, { verificationStatus: "verified", verifiedBy: session.uid, verificationDate: new Date().toISOString() });
  if (resource === "agreements" && action === "approve") {
    return signChild(SQ_COLLECTIONS.agreements, id, "supplierQualityAgreement:approve", session, idToken, comment, { approvalStatus: "approved", status: "approved" });
  }
  if (resource === "changes" && action === "approve") {
    return advanceSqRecord({ collection: SQ_COLLECTIONS.changes, id, next: "implementation", map: CHANGE_TRANSITIONS, permission: "supplierQualityChange:approve", session, idToken, comment, label: "Supplier change", audit: "SUPPLIER_CHANGE_APPROVED", requireSod: true });
  }
  if (resource === "changes" && action === "link_change") {
    return linkCapaOrChange({ collection: SQ_COLLECTIONS.changes, id, payload, session, idToken, permission: "supplierQualityChange:update" });
  }
  if (resource === "changes") {
    return advanceSqRecord({ collection: SQ_COLLECTIONS.changes, id, next: ACTION_STATUS[action] || action, map: CHANGE_TRANSITIONS, permission: "supplierQualityChange:update", session, idToken, comment, label: "Supplier change", lockStatuses: ["closed"] });
  }
  if (resource === "suspensions" && (action === "approve" || action === "suspend")) {
    const next = action === "suspend" ? "suspended" : "approved";
    const result = await advanceSqRecord({ collection: SQ_COLLECTIONS.suspensions, id, next, map: SUSPENSION_TRANSITIONS, permission: "supplierQualitySuspension:approve", session, idToken, comment, label: "Suspension", audit: next === "suspended" ? "SUPPLIER_SUSPENDED" : "SUSPENSION_APPROVED", requireSod: true });
    if (next === "suspended") await syncProfileStatus(text(result.record.supplierId), "suspended", session, idToken);
    return result;
  }
  if (resource === "suspensions" && action === "reactivate") {
    const result = await advanceSqRecord({ collection: SQ_COLLECTIONS.suspensions, id, next: "reactivated", map: SUSPENSION_TRANSITIONS, permission: "supplierQualitySuspension:approve", session, idToken, comment, label: "Suspension", audit: "SUPPLIER_REACTIVATED", requireSod: true });
    await syncProfileStatus(text(result.record.supplierId), "approved", session, idToken);
    return result;
  }
  if (resource === "suspensions" && action === "disqualify") {
    const result = await advanceSqRecord({ collection: SQ_COLLECTIONS.suspensions, id, next: "disqualified", map: SUSPENSION_TRANSITIONS, permission: "supplierQualitySuspension:approve", session, idToken, comment, label: "Suspension", audit: "SUPPLIER_DISQUALIFIED", requireSod: true });
    await syncProfileStatus(text(result.record.supplierId), "disqualified", session, idToken);
    return result;
  }
  if (resource === "suspensions") {
    return advanceSqRecord({ collection: SQ_COLLECTIONS.suspensions, id, next: ACTION_STATUS[action] || action, map: SUSPENSION_TRANSITIONS, permission: "supplierQualitySuspension:create", session, idToken, comment, label: "Suspension" });
  }
  if (resource === "requalifications" && action === "approve") {
    return advanceSqRecord({ collection: SQ_COLLECTIONS.requalifications, id, next: "approved", map: REQUAL_TRANSITIONS, permission: "supplierQualityRequalification:approve", session, idToken, comment, label: "Requalification", audit: "REQUALIFICATION_APPROVED", extra: { decision: "approved" }, requireSod: true });
  }
  if (resource === "requalifications") {
    return advanceSqRecord({ collection: SQ_COLLECTIONS.requalifications, id, next: ACTION_STATUS[action] || action, map: REQUAL_TRANSITIONS, permission: "supplierQualityRequalification:update", session, idToken, comment, label: "Requalification" });
  }
  throw createNamedError("ValidationError", "Unknown supplier-quality action.");
}

const ACTION_STATUS: Record<string, string> = {
  screening: "screening",
  qualification_pending: "qualification_pending",
  under_evaluation: "under_evaluation",
  audit_required: "audit_required",
  under_audit: "under_audit",
  qa_review: "qa_review",
  approved: "approved",
  conditional_approval: "conditional_approval",
  expired: "expired",
  document_collection: "document_collection",
  questionnaire: "questionnaire",
  evaluation: "evaluation",
  sent: "sent",
  supplier_response: "supplier_response",
  internal_review: "internal_review",
  clarification: "clarification",
  final_review: "final_review",
  rejected: "rejected",
  planned: "planned",
  scheduled: "scheduled",
  in_progress: "in_progress",
  findings_recorded: "findings_recorded",
  capa_pending: "capa_pending",
  follow_up: "follow_up",
  received: "received",
  impact_assessment: "impact_assessment",
  approval: "approval",
  implementation: "implementation",
  verification: "verification",
  proposed: "proposed",
  planning: "planning",
  document_review: "document_review",
  audit: "audit",
  approve: "approved",
};

async function signChild(collection: string, id: string, permission: Permission, session: SessionPayload, idToken: string, reason: string, extra: Record<string, unknown> = {}) {
  ensurePermission(session, permission);
  const record = await requireRecord(collection, id, idToken, "Record");
  const next = { ...record, ...extra, status: extra.status || "approved", approvalSignature: electronicSignature(session, "approve", reason), ...actorStamp(session, record) };
  await commitWrites([writeOf(collection, id, next)], idToken);
  return { id, record: next };
}

async function syncProfileStatus(supplierId: string, status: string, session: SessionPayload, idToken: string) {
  if (!supplierId) return;
  const profiles = await (await import("@/lib/masters/firestore")).queryMasterDocuments(SQ_COLLECTIONS.profiles, idToken, { filters: [{ field: "supplierId", value: supplierId }], limit: 1 });
  const profile = profiles[0];
  if (!profile) return;
  const next = { ...profile, status, ...actorStamp(session, profile) };
  await commitWrites([writeOf(SQ_COLLECTIONS.profiles, profile.id, next)], idToken);
  await auditSq(idToken, session, {
    action: status === "suspended" ? "SUPPLIER_SUSPENDED" : status === "disqualified" ? "SUPPLIER_DISQUALIFIED" : "SUPPLIER_REACTIVATED",
    resource: SQ_COLLECTIONS.profiles,
    resourceId: profile.id,
    description: `Supplier profile moved to ${status}.`,
    oldData: { status: profile.status },
    newData: { status },
  });
}
