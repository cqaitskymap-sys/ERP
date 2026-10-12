import type { ReleaseValidation } from "@/types/qa";
import { text } from "@/lib/qa/helpers";

export function validateBatchForRelease(input: {
  order?: Record<string, unknown> | null;
  bmr?: Record<string, unknown> | null;
  reconciliations?: Array<Record<string, unknown>>;
  ipc?: Array<Record<string, unknown>>;
  tests?: Array<Record<string, unknown>>;
  oos?: Array<Record<string, unknown>>;
  oot?: Array<Record<string, unknown>>;
  deviations?: Array<Record<string, unknown>>;
  checklist?: Array<Record<string, unknown>>;
  documents?: Array<Record<string, unknown>>;
  coas?: Array<Record<string, unknown>>;
}): ReleaseValidation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const order = input.order || {};
  const moStatus = text(order.status);
  if (!["completed", "qc_pending", "qa_pending", "held"].includes(moStatus) && text(order.qcStatus) !== "completed") {
    blockers.push("Manufacturing is not complete.");
  }
  const bmrComplete = ["completed", "reviewed", "closed"].includes(text(input.bmr?.status));
  if (!input.bmr || !bmrComplete) blockers.push("BMR is incomplete.");

  const recons = input.reconciliations || [];
  if (!recons.length || recons.some((row) => !["reconciled", "completed"].includes(text(row.status)))) {
    if (!recons.length) warnings.push("Reconciliation records were not found.");
    else if (recons.some((row) => text(row.status) === "variance")) blockers.push("Reconciliation is incomplete.");
    else warnings.push("Reconciliation is still pending review.");
  }

  const ipc = input.ipc || [];
  if (ipc.some((row) => text(row.result) === "fail" || text(row.result) === "pending")) {
    blockers.push("Required IPC is incomplete.");
  }
  if (!ipc.length) warnings.push("No in-process checks were posted.");

  const tests = input.tests || [];
  const completedTests = tests.filter((row) => ["completed", "reviewed"].includes(text(row.status)) || text(row.overallResult) === "pass");
  if (!tests.length) blockers.push("QC testing is not complete.");
  else if (tests.some((row) => !["completed", "reviewed"].includes(text(row.status)))) blockers.push("QC testing is not complete.");
  if (tests.some((row) => text(row.overallResult) === "fail")) blockers.push("Required QC results are not approved.");
  if (completedTests.length && tests.every((row) => text(row.overallResult) !== "fail") && tests.some((row) => text(row.status) !== "completed" && text(row.status) !== "reviewed")) {
    blockers.push("Required QC results are not approved.");
  }

  const openOos = (input.oos || []).filter((row) => text(row.status) !== "closed");
  if (openOos.length) blockers.push("OOS investigation is open.");

  const openOot = (input.oot || []).filter((row) => text(row.status) !== "closed");
  if (openOot.length) warnings.push("OOT records remain open.");

  const criticalDevs = (input.deviations || []).filter(
    (row) => text(row.severity) === "critical" && !["closed"].includes(text(row.status))
  );
  if (criticalDevs.length) blockers.push("Critical deviation is open.");

  const checklist = input.checklist || [];
  const mandatoryOpen = checklist.filter(
    (row) => row.mandatory !== false && !["satisfactory", "not_applicable"].includes(text(row.status))
  );
  if (mandatoryOpen.length) blockers.push("QA checklist is incomplete.");

  const requiredDocs = (input.documents || []).filter((row) => row.required !== false);
  if (requiredDocs.length && requiredDocs.some((row) => !["approved", "effective"].includes(text(row.status)))) {
    blockers.push("Required documents are unavailable.");
  }

  const approvedCoa = (input.coas || []).filter((row) => text(row.status) === "approved");
  if (!(input.coas || []).length) blockers.push("COA is unavailable.");
  else if (!approvedCoa.length) blockers.push("COA is unavailable.");

  const uniqueBlockers = [...new Set(blockers)];
  const uniqueWarnings = [...new Set(warnings)];
  return { eligible: uniqueBlockers.length === 0, blockers: uniqueBlockers, warnings: uniqueWarnings };
}
