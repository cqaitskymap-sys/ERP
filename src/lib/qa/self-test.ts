import { ok, strictEqual } from "node:assert/strict";
import { validateBatchForRelease } from "@/lib/qa/release-validation";
import {
  canTransition,
  CAPA_TRANSITIONS,
  CHANGE_TRANSITIONS,
  DEVIATION_TRANSITIONS,
  DOCUMENT_TRANSITIONS,
  REVIEW_TRANSITIONS,
} from "@/lib/qa/status";
import { canTransitionQuality } from "@/lib/inventory/quality";
import { canTransition as canMoTransition, MO_TRANSITIONS } from "@/lib/production/status";
import { assertSeparationOfDuties } from "@/lib/qa/approvals";
import { electronicSignature } from "@/lib/qa/helpers";
import type { SessionPayload } from "@/types/auth";

const session = {
  uid: "qa-user",
  email: "qa@example.com",
  role: "qa",
  roles: ["qa"],
  permissions: [],
} as unknown as SessionPayload;

export function runQaSelfTests() {
  const blocked = validateBatchForRelease({});
  ok(!blocked.eligible);
  ok(blocked.blockers.includes("BMR is incomplete."));
  ok(blocked.blockers.includes("QC testing is not complete."));
  ok(blocked.blockers.includes("COA is unavailable."));

  const eligible = validateBatchForRelease({
    order: { status: "qa_pending", qcStatus: "completed" },
    bmr: { status: "completed" },
    reconciliations: [{ status: "completed" }],
    ipc: [{ result: "pass" }],
    tests: [{ status: "completed", overallResult: "pass" }],
    oos: [{ status: "closed" }],
    oot: [{ status: "closed" }],
    deviations: [{ severity: "critical", status: "closed" }],
    checklist: [{ mandatory: true, status: "satisfactory" }],
    documents: [],
    coas: [{ status: "approved" }],
  });
  strictEqual(eligible.eligible, true);
  strictEqual(eligible.blockers.length, 0);

  const openCritical = validateBatchForRelease({
    order: { status: "qa_pending", qcStatus: "completed" },
    bmr: { status: "completed" },
    reconciliations: [{ status: "completed" }],
    ipc: [{ result: "pass" }],
    tests: [{ status: "completed", overallResult: "pass" }],
    oos: [],
    deviations: [{ severity: "critical", status: "open" }],
    checklist: [{ mandatory: true, status: "satisfactory" }],
    coas: [{ status: "approved" }],
  });
  ok(openCritical.blockers.includes("Critical deviation is open."));

  const incompleteChecklist = validateBatchForRelease({
    order: { status: "qa_pending", qcStatus: "completed" },
    bmr: { status: "completed" },
    reconciliations: [{ status: "completed" }],
    ipc: [{ result: "pass" }],
    tests: [{ status: "completed", overallResult: "pass" }],
    checklist: [{ mandatory: true, status: "pending" }],
    coas: [{ status: "approved" }],
  });
  ok(incompleteChecklist.blockers.includes("QA checklist is incomplete."));

  ok(canTransition(REVIEW_TRANSITIONS, "pending_review", "under_review"));
  ok(!canTransition(REVIEW_TRANSITIONS, "pending_review", "released"));
  ok(canTransition(REVIEW_TRANSITIONS, "under_review", "released"));
  ok(canTransition(REVIEW_TRANSITIONS, "decision_pending", "held"));
  ok(canTransition(REVIEW_TRANSITIONS, "held", "released"));
  ok(!canTransition(REVIEW_TRANSITIONS, "released", "rejected"));
  ok(!canTransition(REVIEW_TRANSITIONS, "rejected", "released"));

  ok(canTransition(DEVIATION_TRANSITIONS, "open", "investigation"));
  ok(canTransition(DEVIATION_TRANSITIONS, "investigation", "capa_required"));
  ok(!canTransition(DEVIATION_TRANSITIONS, "closed", "open"));

  ok(canTransition(CAPA_TRANSITIONS, "draft", "open"));
  ok(canTransition(CAPA_TRANSITIONS, "effectiveness_review", "closed"));
  ok(!canTransition(CAPA_TRANSITIONS, "closed", "open"));

  ok(canTransition(CHANGE_TRANSITIONS, "draft", "submitted"));
  ok(canTransition(CHANGE_TRANSITIONS, "qa_review", "approved"));
  ok(!canTransition(CHANGE_TRANSITIONS, "submitted", "implementation"));
  ok(!canTransition(CHANGE_TRANSITIONS, "draft", "implementation"));

  ok(canTransition(DOCUMENT_TRANSITIONS, "draft", "under_review"));
  ok(canTransition(DOCUMENT_TRANSITIONS, "approved", "effective"));
  ok(!canTransition(DOCUMENT_TRANSITIONS, "effective", "draft"));
  ok(!canTransition(DOCUMENT_TRANSITIONS, "superseded", "approved"));

  ok(!canTransitionQuality("quarantine", "approved"));
  ok(canTransitionQuality("quarantine", "under_testing"));
  ok(canTransitionQuality("under_testing", "approved"));
  ok(canTransitionQuality("under_testing", "blocked"));
  ok(canTransitionQuality("under_testing", "rejected"));

  ok(!canMoTransition(MO_TRANSITIONS, "qc_pending", "released"));
  ok(canMoTransition(MO_TRANSITIONS, "qa_pending", "released"));
  ok(canMoTransition(MO_TRANSITIONS, "qa_pending", "held"));
  ok(canMoTransition(MO_TRANSITIONS, "qa_pending", "rejected"));

  try {
    assertSeparationOfDuties({
      session,
      manufacturedBy: "qa-user",
      allowSelfApproval: false,
    });
    ok(false, "manufacturing user must not release");
  } catch {
    ok(true);
  }
  try {
    assertSeparationOfDuties({
      session,
      qcAnalystId: "qa-user",
      allowSelfApproval: false,
    });
    ok(false, "QC analyst must not release");
  } catch {
    ok(true);
  }
  assertSeparationOfDuties({
    session,
    manufacturedBy: "prod-user",
    qcAnalystId: "qc-user",
    qcApproverId: "qc-approver",
    allowSelfApproval: false,
  });

  const signature = electronicSignature(session, "release", "Eligible batch");
  ok(signature.signatureReference);
  ok(signature.signedBy === "qa-user");
  ok(!("password" in signature));

  return "qa self-tests passed";
}

console.log(runQaSelfTests());
