import { ok, strictEqual } from "node:assert/strict";
import { calculateComplaintDueDate, calculateComplaintTAT, daysUntilUtc, summarizeTats } from "@/lib/complaints/sla";
import { calculateRiskScore, electronicSignature, riskLevelFromScore } from "@/lib/complaints/helpers";
import {
  COMMUNICATION_TRANSITIONS,
  COMPLAINT_TRANSITIONS,
  INVESTIGATION_TRANSITIONS,
  NOTIFICATION_TRANSITIONS,
  RECALL_TRANSITIONS,
  SAMPLE_TRANSITIONS,
  canTransition,
} from "@/lib/complaints/status";
import type { SessionPayload } from "@/types/auth";

export function runComplaintSelfTests() {
  const due = calculateComplaintDueDate("2026-09-05T00:00:00.000Z", { id: "sla-1", closureDays: 10, timezone: "UTC", version: "2" });
  ok(due.dueDate.startsWith("2026-09-15"));
  strictEqual(due.ruleId, "sla-1");
  ok(due.acknowledgementDueDate);

  const tat = calculateComplaintTAT("2026-09-05T00:00:00.000Z", "2026-09-06T12:00:00.000Z");
  strictEqual(tat, 36);

  const summary = summarizeTats([10, 20, 30]);
  strictEqual(summary.averageTatHours, 20);
  strictEqual(summary.minTatHours, 10);
  strictEqual(summary.maxTatHours, 30);

  ok(daysUntilUtc("2026-09-06T00:00:00.000Z", new Date("2026-09-05T00:00:00.000Z")) === 1);

  ok(canTransition(COMPLAINT_TRANSITIONS, "received", "triage"));
  ok(!canTransition(COMPLAINT_TRANSITIONS, "received", "closed"));
  ok(canTransition(COMPLAINT_TRANSITIONS, "closed", "reopened"));
  ok(!canTransition(COMPLAINT_TRANSITIONS, "closed", "triage"));
  ok(!canTransition(COMPLAINT_TRANSITIONS, "cancelled", "triage"));

  ok(canTransition(INVESTIGATION_TRANSITIONS, "initiated", "in_progress"));
  ok(!canTransition(INVESTIGATION_TRANSITIONS, "closed", "initiated"));

  ok(canTransition(SAMPLE_TRANSITIONS, "received", "logged"));
  ok(!canTransition(SAMPLE_TRANSITIONS, "disposed", "received"));

  ok(canTransition(RECALL_TRANSITIONS, "potential", "assessment"));
  ok(!canTransition(RECALL_TRANSITIONS, "potential", "initiated"));
  ok(!canTransition(RECALL_TRANSITIONS, "potential", "closed"));

  ok(canTransition(NOTIFICATION_TRANSITIONS, "approved", "submitted"));
  ok(!canTransition(NOTIFICATION_TRANSITIONS, "submitted", "preparing"));

  ok(canTransition(COMMUNICATION_TRANSITIONS, "approved", "sent"));
  ok(!canTransition(COMMUNICATION_TRANSITIONS, "draft", "sent"));

  strictEqual(calculateRiskScore(5, 5, 5, "severity * occurrence * detectability"), 125);
  strictEqual(calculateRiskScore(5, 5, 5, "severity * occurrence"), 25);
  strictEqual(riskLevelFromScore(125), "critical");
  strictEqual(riskLevelFromScore(10), "low");

  const signature = electronicSignature(
    { uid: "qa-user", email: "qa@example.com", role: "qa" } as SessionPayload,
    "qa_decision",
    "Reviewed"
  );
  ok(signature.signatureReference);
  ok(!("password" in signature));
  ok(signature.signedBy === "qa-user");

  return "complaint self-tests passed";
}

console.log(runComplaintSelfTests());
