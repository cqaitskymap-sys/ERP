import { RA_COLLECTIONS } from "@/lib/ra/collections";
import { RA_RESOURCES, type RaResource } from "@/lib/ra/http";
import {
  loadDossierDetail,
  loadQueryDetail,
  loadRegistrationDetail,
  loadSubmissionDetail,
} from "@/lib/ra/query";
import {
  approveArtwork,
  approveDossier,
  approveRegistration,
  approveRegulatoryChange,
  approveRegulatoryDocument,
  approveRenewal,
  approveSubmission,
  ARTWORK_TRANSITIONS,
  assignQuery,
  CHANGE_TRANSITIONS,
  closeQuery,
  DOCUMENT_TRANSITIONS,
  completeCommitment,
  COMMITMENT_TRANSITIONS,
  createArtworkReview,
  createAuthority,
  createCommitment,
  createCustomerRequirement,
  createDossier,
  createLicense,
  createMarket,
  createRegistration,
  createRegulatoryChange,
  createRegulatoryCommunication,
  createRegulatoryDocument,
  createRegulatoryProfile,
  createRegulatoryQuery,
  createRenewal,
  createSubmission,
  createSubmissionVersion,
  LICENSE_TRANSITIONS,
  PROFILE_TRANSITIONS,
  QUERY_TRANSITIONS,
  REGISTRATION_TRANSITIONS,
  renewLicense,
  RENEWAL_TRANSITIONS,
  SUBMISSION_TRANSITIONS,
  submitQueryResponse,
  submitSubmission,
  updateMasterLike,
  updateRegistration,
} from "@/lib/ra/server";
import { canTransition } from "@/lib/ra/status";
import {
  actorStamp,
  auditRa,
  commitWrites,
  electronicSignature,
  ensurePermission,
  requireRecord,
  workflowFail,
  writeOf,
  text,
} from "@/lib/ra/helpers";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";

export async function createRaRecord(resource: RaResource, payload: Record<string, unknown>, session: SessionPayload, idToken: string) {
  if (resource === "profiles") return createRegulatoryProfile({ payload, session, idToken });
  if (resource === "markets") return createMarket({ payload, session, idToken });
  if (resource === "authorities") return createAuthority({ payload, session, idToken });
  if (resource === "registrations") return createRegistration({ payload, session, idToken });
  if (resource === "submissions") return createSubmission({ payload, session, idToken });
  if (resource === "dossiers") return createDossier({ payload, session, idToken });
  if (resource === "documents") return createRegulatoryDocument({ payload, session, idToken });
  if (resource === "licenses") return createLicense({ payload, session, idToken });
  if (resource === "renewals") return createRenewal({ payload, session, idToken });
  if (resource === "queries") return createRegulatoryQuery({ payload, session, idToken });
  if (resource === "commitments") return createCommitment({ payload, session, idToken });
  if (resource === "communications") return createRegulatoryCommunication({ payload, session, idToken });
  if (resource === "requirements") return createCustomerRequirement({ payload, session, idToken });
  if (resource === "artworks") return createArtworkReview({ payload, session, idToken });
  if (resource === "changes") return createRegulatoryChange({ payload, session, idToken });
  throw createNamedError("ValidationError", "This RA resource cannot be created directly.");
}

export async function loadRaDetail(resource: RaResource, id: string, idToken: string) {
  if (resource === "registrations") return loadRegistrationDetail(id, idToken);
  if (resource === "submissions") return loadSubmissionDetail(id, idToken);
  if (resource === "dossiers") return loadDossierDetail(id, idToken);
  if (resource === "queries") return loadQueryDetail(id, idToken);
  const record = await readMasterDocument(RA_RESOURCES[resource].collection, id, idToken);
  if (!record) return null;
  return { record, extra: {} };
}

export async function runRaAction(
  resource: RaResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  const comment = String(payload.comment || payload.reason || "");
  if (resource === "registrations" && action === "approve") return approveRegistration({ id, comment, session, idToken });
  if (resource === "registrations" && action === "update") return updateRegistration({ id, payload, session, idToken });
  if (resource === "registrations") {
    return step(RA_COLLECTIONS.registrations, id, action, REGISTRATION_TRANSITIONS, "raRegistration:update", session, idToken, comment, "Registration");
  }
  if (resource === "submissions" && action === "version") return createSubmissionVersion({ id, comment, session, idToken });
  if (resource === "submissions" && action === "approve") return approveSubmission({ id, comment, session, idToken });
  if (resource === "submissions" && action === "submit") return submitSubmission({ id, comment, session, idToken });
  if (resource === "submissions") {
    return step(RA_COLLECTIONS.submissions, id, action, SUBMISSION_TRANSITIONS, "raSubmission:update", session, idToken, comment, "Submission");
  }
  if (resource === "dossiers" && action === "approve") return approveDossier({ id, comment, session, idToken });
  if (resource === "documents" && action === "approve") return approveRegulatoryDocument({ id, comment, session, idToken });
  if (resource === "documents") {
    return step(RA_COLLECTIONS.documents, id, action, DOCUMENT_TRANSITIONS, "raDocument:update", session, idToken, comment, "Document");
  }
  if (resource === "licenses" && action === "renew") return renewLicense({ id, payload, session, idToken });
  if (resource === "licenses") {
    return step(RA_COLLECTIONS.licenses, id, action, LICENSE_TRANSITIONS, "raLicense:update", session, idToken, comment, "License");
  }
  if (resource === "renewals" && action === "approve") return approveRenewal({ id, payload, comment, session, idToken });
  if (resource === "renewals") {
    return step(RA_COLLECTIONS.renewals, id, action, RENEWAL_TRANSITIONS, "raRenewal:update", session, idToken, comment, "Renewal");
  }
  if (resource === "queries" && action === "assign") return assignQuery({ id, payload, session, idToken });
  if (resource === "queries" && action === "submit") return submitQueryResponse({ id, comment, session, idToken });
  if (resource === "queries" && action === "close") return closeQuery({ id, comment, session, idToken });
  if (resource === "queries" && action === "approve") {
    return step(RA_COLLECTIONS.queries, id, "approved", QUERY_TRANSITIONS, "raQuery:approve", session, idToken, comment, "Query");
  }
  if (resource === "queries") {
    return step(RA_COLLECTIONS.queries, id, action, QUERY_TRANSITIONS, "raQuery:update", session, idToken, comment, "Query");
  }
  if (resource === "commitments" && action === "complete") return completeCommitment({ id, comment, session, idToken });
  if (resource === "commitments") {
    return step(RA_COLLECTIONS.commitments, id, action, COMMITMENT_TRANSITIONS, "raCommitment:update", session, idToken, comment, "Commitment");
  }
  if (resource === "artworks" && action === "approve") return approveArtwork({ id, comment, session, idToken });
  if (resource === "artworks") {
    return step(RA_COLLECTIONS.artworks, id, action, ARTWORK_TRANSITIONS, "raArtwork:create", session, idToken, comment, "Artwork");
  }
  if (resource === "changes" && action === "approve") return approveRegulatoryChange({ id, comment, session, idToken });
  if (resource === "changes") {
    return step(RA_COLLECTIONS.changes, id, action, CHANGE_TRANSITIONS, "raRegulatoryChange:update", session, idToken, comment, "Regulatory change");
  }
  if (resource === "profiles") {
    return step(RA_COLLECTIONS.profiles, id, action, PROFILE_TRANSITIONS, "raProduct:update", session, idToken, comment, "Regulatory profile");
  }
  if (resource === "markets") return updateMasterLike({ collection: RA_COLLECTIONS.markets, id, permission: "raMarket:update", payload, session, idToken, label: "Market" });
  if (resource === "authorities") return updateMasterLike({ collection: RA_COLLECTIONS.authorities, id, permission: "raAuthority:update", payload, session, idToken, label: "Authority" });
  throw createNamedError("ValidationError", "Unknown RA action.");
}

const ACTION_STATUS: Record<string, string> = {
  prepare: "preparation",
  submit: "submitted",
  review: "under_review",
  acknowledge: "acknowledged",
  query: "query_received",
  respond: "response_submitted",
  approve: "approved",
  reject: "rejected",
  withdraw: "withdrawn",
  suspend: "suspended",
  expire: "expired",
  activate: "active",
  cancel: "cancelled",
  plan: "planning",
  ready: "ready",
  assign: "assigned",
  start: "in_progress",
  assess: "ra_assessment",
  impact: "impact_assessment",
  department: "department_review",
  plan_action: "action_plan",
  implement: "implementation",
  verify: "verification",
  close: "closed",
  complete: "completed",
  evidence: "pending_evidence",
  customer: "customer_review",
  ra_review: "ra_review",
  internal: "internal_review",
  preparation: "in_preparation",
  assessment: "assessment_pending",
  required: "registration_required",
  in_progress: "registration_in_progress",
  register: "registered",
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
  label: string
) {
  ensurePermission(session, permission);
  const record = await requireRecord(collection, id, idToken, label);
  const next = ACTION_STATUS[action] || action;
  if (!canTransition(map, text(record.status), next)) workflowFail(text(record.status), next);
  const updated = {
    ...record,
    status: next,
    approvalSignature: electronicSignature(session, next, comment),
    ...actorStamp(session, record),
  };
  await commitWrites([writeOf(collection, id, updated)], idToken);
  await auditRa(idToken, session, {
    action: `${label.toUpperCase().replace(/\s+/g, "_")}_UPDATED`,
    resource: collection,
    resourceId: id,
    description: `${label} moved to ${next}.`,
    oldData: { status: record.status },
    newData: { status: next },
    reason: comment,
  });
  return { id, record: updated };
}
