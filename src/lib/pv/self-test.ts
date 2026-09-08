import { ok, strictEqual } from "node:assert/strict";
import { calculateCaseDueDate, calculateReportingDueDate, daysUntilUtc } from "@/lib/pv/due-date";
import { electronicSignature, validateMinimumCaseInformation } from "@/lib/pv/helpers";
import {
  CASE_TRANSITIONS,
  FOLLOWUP_TRANSITIONS,
  INTAKE_TRANSITIONS,
  REPORT_TRANSITIONS,
  SIGNAL_TRANSITIONS,
  canTransition,
} from "@/lib/pv/status";
import type { SessionPayload } from "@/types/auth";

export function runPvSelfTests() {
  const complete = validateMinimumCaseInformation({
    patientReference: "P-1",
    reporterType: "physician",
    productId: "prod-1",
    eventTerm: "rash",
  });
  strictEqual(complete.status, "complete");
  ok(complete.identifiablePatient && complete.identifiableReporter && complete.suspectProduct && complete.adverseEvent);

  const incomplete = validateMinimumCaseInformation({ description: "unclear" });
  strictEqual(incomplete.status, "incomplete");

  const review = validateMinimumCaseInformation({ patientReference: "P-2", eventTerm: "headache" });
  strictEqual(review.status, "requires_review");

  const due = calculateCaseDueDate("2026-09-05T00:00:00.000Z", { id: "rule-1", processingWindow: 10, timezone: "UTC", version: "2" });
  ok(due.dueDate.startsWith("2026-09-15"));
  strictEqual(due.ruleId, "rule-1");
  strictEqual(due.timezone, "UTC");

  const noWindow = calculateReportingDueDate("2026-09-05T00:00:00.000Z", { id: "" });
  strictEqual(noWindow.dueDate, "");

  const reporting = calculateReportingDueDate("2026-09-05T00:00:00.000Z", { id: "r2", reportingWindow: 7, timezone: "Asia/Kolkata" });
  ok(reporting.dueDate.startsWith("2026-09-12"));

  ok(daysUntilUtc("2026-09-06T00:00:00.000Z", new Date("2026-09-05T00:00:00.000Z")) === 1);

  ok(canTransition(INTAKE_TRANSITIONS, "received", "converted_to_case"));
  ok(!canTransition(INTAKE_TRANSITIONS, "converted_to_case", "received"));

  ok(canTransition(CASE_TRANSITIONS, "new", "triage"));
  ok(!canTransition(CASE_TRANSITIONS, "new", "closed"));
  ok(canTransition(CASE_TRANSITIONS, "closed", "reopened"));
  ok(!canTransition(CASE_TRANSITIONS, "closed", "processing"));

  ok(canTransition(FOLLOWUP_TRANSITIONS, "requested", "pending"));
  ok(!canTransition(FOLLOWUP_TRANSITIONS, "closed", "requested"));

  ok(canTransition(REPORT_TRANSITIONS, "assessment_pending", "required"));
  ok(!canTransition(REPORT_TRANSITIONS, "submitted", "preparing"));
  ok(canTransition(REPORT_TRANSITIONS, "approved", "submitted"));

  ok(canTransition(SIGNAL_TRANSITIONS, "detected", "screening"));
  ok(!canTransition(SIGNAL_TRANSITIONS, "detected", "confirmed"));

  const signature = electronicSignature(
    { uid: "pv-user", email: "pv@example.com", role: "regulatory" } as SessionPayload,
    "medical_review",
    "Reviewed"
  );
  ok(signature.signatureReference);
  ok(!("password" in signature));

  return "pv self-tests passed";
}

console.log(runPvSelfTests());
