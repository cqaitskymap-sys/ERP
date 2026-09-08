import { QC_COLLECTIONS } from "@/lib/qc/collections";
import { QC_RESOURCES, type QcResource } from "@/lib/qc/http";
import { listByField } from "@/lib/qc/helpers";
import { loadApprovals } from "@/lib/qc/approvals";
import { loadTestWorkbench } from "@/lib/qc/query";
import {
  actOnSampleRequest,
  actOnSpecification,
  actOnTestMethod,
  approveCOA,
  assignTest,
  createInstrument,
  createOOS,
  createOOT,
  createQCDisposition,
  createResample,
  createRetest,
  createSampleRequest,
  createSpecification,
  createStabilityStudy,
  createStandard,
  createTestMethod,
  createTestRequest,
  generateCOA,
  receiveSample,
  recordTestResult,
  registerReceivedSample,
  registerSample,
  reviewTest,
  saveQcDocument,
  startTest,
  submitTest,
} from "@/lib/qc/server";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";

export async function createQcRecord(resource: QcResource, payload: Record<string, unknown>, session: SessionPayload, idToken: string) {
  if (resource === "sampleRequests") return createSampleRequest({ payload, session, idToken });
  if (resource === "samples") return registerSample({ payload, session, idToken });
  if (resource === "testRequests") return createTestRequest({ payload, session, idToken });
  if (resource === "assignments") return assignTest({ payload, session, idToken });
  if (resource === "results") return recordTestResult({ payload, session, idToken });
  if (resource === "specifications") return createSpecification({ payload, session, idToken });
  if (resource === "methods") return createTestMethod({ payload, session, idToken });
  if (resource === "oos") return createOOS({ payload, session, idToken });
  if (resource === "oot") return createOOT({ payload, session, idToken });
  if (resource === "retests") return createRetest({ payload, session, idToken });
  if (resource === "resampling") return createResample({ payload, session, idToken });
  if (resource === "coas") return generateCOA({ payload, session, idToken });
  if (resource === "dispositions") return createQCDisposition({ payload, session, idToken });
  if (resource === "instruments") return createInstrument({ payload, session, idToken });
  if (resource === "standards") return createStandard({ payload, session, idToken });
  if (resource === "stability") return createStabilityStudy({ payload, session, idToken });
  throw createNamedError("ValidationError", "This QC resource cannot be created directly.");
}

export async function loadQcDetail(resource: QcResource, id: string, idToken: string) {
  if (resource === "tests") return loadTestWorkbench(id, idToken);
  const collection = QC_RESOURCES[resource].collection;
  const record = await readMasterDocument(collection, id, idToken);
  if (!record) return null;
  const extra: Record<string, unknown> = {};
  if (resource === "specifications") extra.items = await listByField(QC_COLLECTIONS.specificationItems, "specificationId", id, idToken);
  if (resource === "samples") extra.tests = await listByField(QC_COLLECTIONS.testRequests, "sampleId", id, idToken);
  if (resource === "testRequests") {
    extra.tests = await listByField(QC_COLLECTIONS.tests, "testRequestId", id, idToken);
    extra.results = await listByField(QC_COLLECTIONS.results, "testRequestId", id, idToken);
  }
  if (resource === "coas") extra.lines = record.lines;
  if (["sampleRequests", "specifications", "testRequests", "coas"].includes(resource)) {
    extra.approvals = await loadApprovals(resource, id, idToken);
  }
  if (resource === "stability") extra.timepoints = await listByField(QC_COLLECTIONS.timepoints, "stabilityStudyId", id, idToken);
  return { record, extra };
}

export async function runQcAction(
  resource: QcResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  const comment = String(payload.comment || payload.reason || payload.remarks || "");
  if (resource === "sampleRequests") return actOnSampleRequest({ id, action: action as "submit" | "approve" | "reject" | "cancel", comment, session, idToken });
  if (resource === "samples" && action === "receive") return receiveSample({ id, payload, session, idToken });
  if (resource === "samples" && action === "register") return registerReceivedSample({ id, session, idToken });
  if (resource === "specifications") return actOnSpecification({ id, action: action as "submit" | "approve" | "reject" | "return" | "activate", comment, session, idToken });
  if (resource === "methods") return actOnTestMethod({ id, action: action as "submit" | "approve", comment, session, idToken });
  if (resource === "tests" && action === "start") return startTest({ id, session, idToken });
  if (resource === "tests" && action === "submit") return submitTest({ id, comment, session, idToken });
  if (resource === "tests" && ["approve", "reject", "return"].includes(action)) {
    return reviewTest({ id, action: action as "approve" | "reject" | "return", comment, session, idToken });
  }
  if (resource === "coas" && action === "approve") return approveCOA({ id, comment, session, idToken });
  if (action === "document") return saveQcDocument({ payload: { ...payload, parentId: id }, session, idToken });
  throw createNamedError("ValidationError", "Unknown QC action.");
}
