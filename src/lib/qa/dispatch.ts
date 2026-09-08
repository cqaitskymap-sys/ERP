import { QA_RESOURCES, type QaResource } from "@/lib/qa/http";
import { loadQaReviewDetail } from "@/lib/qa/query";
import {
  actOnDocument,
  advanceChangeControl,
  approveCAPA,
  closeCAPA,
  closeDeviation,
  completeBatchReview,
  createBatchReview,
  createCAPA,
  createChangeControl,
  createDeviation,
  createDocumentReview,
  decideBatch,
  generateReleaseCertificate,
  startBatchReview,
  updateChecklistItem,
  updateDeviation,
} from "@/lib/qa/server";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";

export async function createQaRecord(resource: QaResource, payload: Record<string, unknown>, session: SessionPayload, idToken: string) {
  if (resource === "reviews") return createBatchReview({ payload, session, idToken });
  if (resource === "deviations") return createDeviation({ payload, session, idToken });
  if (resource === "capas") return createCAPA({ payload, session, idToken });
  if (resource === "changes") return createChangeControl({ payload, session, idToken });
  if (resource === "documents") return createDocumentReview({ payload, session, idToken });
  if (resource === "certificates") return generateReleaseCertificate({ reviewId: String(payload.reviewId || ""), session, idToken });
  throw createNamedError("ValidationError", "This QA resource cannot be created directly.");
}

export async function loadQaDetail(resource: QaResource, id: string, idToken: string) {
  if (resource === "reviews") return loadQaReviewDetail(id, idToken);
  const record = await readMasterDocument(QA_RESOURCES[resource].collection, id, idToken);
  if (!record) return null;
  return { record, extra: {} };
}

export async function runQaAction(
  resource: QaResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  const comment = String(payload.comment || payload.reason || "");
  if (resource === "reviews" && action === "start") return startBatchReview({ id, session, idToken });
  if (resource === "reviews" && action === "complete") return completeBatchReview({ id, session, idToken });
  if (resource === "reviews" && action === "checklist") return updateChecklistItem({ id, payload, session, idToken });
  if (resource === "reviews" && ["release", "hold", "reject", "decide"].includes(action)) {
    return decideBatch({ id, payload: { ...payload, decision: action === "decide" ? payload.decision : action }, session, idToken });
  }
  if (resource === "deviations" && action === "close") return closeDeviation({ id, comment, session, idToken });
  if (resource === "deviations") {
    const nextStatus =
      action === "investigate" || action === "update"
        ? "investigation"
        : action === "review"
          ? "qa_review"
          : action === "capa"
            ? "capa_required"
            : payload.status;
    return updateDeviation({ id, payload: { ...payload, status: nextStatus }, session, idToken });
  }
  if (resource === "capas" && action === "approve") return approveCAPA({ id, comment, session, idToken });
  if (resource === "capas" && action === "close") return closeCAPA({ id, comment, session, idToken });
  if (resource === "changes") return advanceChangeControl({ id, action, comment, session, idToken });
  if (resource === "documents") return actOnDocument({ id, action: action as "submit" | "approve" | "reject" | "activate", comment, session, idToken });
  throw createNamedError("ValidationError", "Unknown QA action.");
}
