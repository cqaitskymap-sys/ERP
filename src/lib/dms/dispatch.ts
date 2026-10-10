import { DMS_COLLECTIONS } from "@/lib/dms/collections";
import { isDmsResource, type DmsResource } from "@/lib/dms/http";
import { listByField, text } from "@/lib/dms/helpers";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import { HR_COLLECTIONS } from "@/lib/hr/collections";
import {
  assignDocumentTraining,
  authorizeDocumentFile,
  compareDocumentVersions,
  completePeriodicReview,
  confirmDocumentUpload,
  createControlledDocument,
  createDocumentChangeRequest,
  createExternalDocument,
  prepareDocumentUpload,
  reviseControlledDocument,
  saveDmsSettings,
  saveDmsTemplate,
  transitionChangeRequest,
  transitionControlledDocument,
  updateControlledDocument,
  updateExternalDocument,
} from "@/lib/dms/server";
import type { SessionPayload } from "@/types/auth";

export async function createDmsRecord(
  resource: DmsResource,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  if (resource === "documents") return createControlledDocument({ payload, session, idToken });
  if (resource === "changeRequests") return createDocumentChangeRequest({ payload, session, idToken });
  if (resource === "externalDocuments") return createExternalDocument({ payload, session, idToken });
  if (resource === "templates") return saveDmsTemplate({ payload, session, idToken });
  if (resource === "settings") return saveDmsSettings({ payload, session, idToken });
  throw createNamedError("ValidationError", "This document-control resource cannot be created directly.");
}

export async function loadDmsDetail(resource: DmsResource, id: string, idToken: string, _session: SessionPayload) {
  const collection =
    resource === "documents"
      ? DMS_COLLECTIONS.documents
      : resource === "changeRequests"
        ? DMS_COLLECTIONS.changeRequests
        : resource === "externalDocuments"
          ? DMS_COLLECTIONS.externalDocuments
          : resource === "templates"
            ? DMS_COLLECTIONS.templates
            : resource === "settings"
              ? DMS_COLLECTIONS.settings
              : resource === "periodicReviews"
                ? DMS_COLLECTIONS.periodicReviews
                : resource === "audit"
                  ? DMS_COLLECTIONS.audit
                  : "";
  if (!collection) return null;
  const record = await readMasterDocument(collection, id, idToken);
  if (!record) return null;
  const extra: Record<string, unknown> = {};
  if (resource === "documents") {
    extra.versions = await listByField(DMS_COLLECTIONS.versions, "documentId", id, idToken, 50);
    extra.reviews = await listByField(DMS_COLLECTIONS.reviews, "documentId", id, idToken, 50);
    extra.approvals = await listByField(DMS_COLLECTIONS.approvals, "documentId", id, idToken, 50);
    extra.changeRequests = await listByField(DMS_COLLECTIONS.changeRequests, "documentId", id, idToken, 30);
    extra.periodicReviews = await listByField(DMS_COLLECTIONS.periodicReviews, "documentId", id, idToken, 20);
    extra.training = await listByField(HR_COLLECTIONS.trainingAssignments, "sopDocumentId", id, idToken, 40).catch(() => []);
  }
  return { record, extra };
}

export async function runDmsAction(
  resource: DmsResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  if (resource === "documents" && action === "update") {
    return updateControlledDocument({ id, payload, session, idToken });
  }
  if (resource === "documents" && action === "revise") {
    return reviseControlledDocument({ id, payload, session, idToken });
  }
  if (resource === "documents" && action === "periodic_review") {
    return completePeriodicReview({ id, payload, session, idToken });
  }
  if (resource === "documents" && action === "assign_training") {
    return assignDocumentTraining({ id, payload, session, idToken });
  }
  if (resource === "documents" && action === "compare") {
    return compareDocumentVersions({
      id,
      leftId: text(payload.leftId),
      rightId: text(payload.rightId),
      idToken,
    });
  }
  if (resource === "documents" && action === "authorize_file") {
    return authorizeDocumentFile({
      documentId: id,
      versionId: text(payload.versionId),
      session,
      idToken,
    });
  }
  if (resource === "documents") {
    return transitionControlledDocument({ id, action, payload, session, idToken });
  }
  if (resource === "changeRequests") return transitionChangeRequest({ id, action, payload, session, idToken });
  if (resource === "externalDocuments" && action === "update") {
    return updateExternalDocument({ id, payload, session, idToken });
  }
  if (!isDmsResource(resource)) throw createNamedError("ValidationError", "Unknown document-control resource.");
  throw createNamedError("ValidationError", `Unsupported action "${action}" for ${resource}.`);
}

export async function prepareDmsUpload(payload: Record<string, unknown>, session: SessionPayload, idToken: string) {
  return prepareDocumentUpload({ payload, session, idToken });
}

export async function confirmDmsUpload(payload: Record<string, unknown>, session: SessionPayload, idToken: string) {
  return confirmDocumentUpload({ payload, session, idToken });
}
