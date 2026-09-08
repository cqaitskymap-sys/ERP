import { ok, strictEqual } from "node:assert/strict";
import { formatDocumentNumber } from "@/lib/masters/numbering";
import { electronicSignature, assertOpen } from "@/lib/supplier-quality/helpers";
import {
  calculateExpiryStatus,
  calculateQualificationStatus,
  calculateRequalificationStatus,
  calculateSupplierPerformance,
  calculateSupplierRisk,
  calculateSupplierScore,
  evaluateSupplierQualityGate,
} from "@/lib/supplier-quality/scoring";
import {
  AUDIT_TRANSITIONS,
  PROFILE_TRANSITIONS,
  QUALIFICATION_TRANSITIONS,
  QUESTIONNAIRE_TRANSITIONS,
  SUSPENSION_TRANSITIONS,
  canTransition,
} from "@/lib/supplier-quality/status";
import type { SessionPayload } from "@/types/auth";

export function runSupplierQualitySelfTests() {
  ok(canTransition(PROFILE_TRANSITIONS, "not_assessed", "screening"));
  ok(!canTransition(PROFILE_TRANSITIONS, "not_assessed", "approved"));
  ok(canTransition(PROFILE_TRANSITIONS, "qa_review", "approved"));
  ok(!canTransition(PROFILE_TRANSITIONS, "disqualified", "approved"));
  ok(canTransition(QUALIFICATION_TRANSITIONS, "qa_review", "approved"));
  ok(!canTransition(QUALIFICATION_TRANSITIONS, "approved", "draft"));
  ok(canTransition(QUESTIONNAIRE_TRANSITIONS, "final_review", "approved"));
  ok(!canTransition(QUESTIONNAIRE_TRANSITIONS, "approved", "sent"));
  ok(canTransition(AUDIT_TRANSITIONS, "planned", "approved"));
  ok(!canTransition(AUDIT_TRANSITIONS, "closed", "in_progress"));
  ok(canTransition(SUSPENSION_TRANSITIONS, "approved", "suspended"));
  ok(!canTransition(SUSPENSION_TRANSITIONS, "disqualified", "reactivated"));

  const noProfile = evaluateSupplierQualityGate({ profile: null, materialQualification: null, regulatedMaterial: true });
  ok(noProfile.allowed);

  const qualified = evaluateSupplierQualityGate({
    profile: { status: "approved" },
    materialQualification: { qualificationStatus: "qualified" },
    regulatedMaterial: true,
  });
  ok(qualified.allowed);

  const suspended = evaluateSupplierQualityGate({
    profile: { status: "suspended" },
    materialQualification: { qualificationStatus: "qualified" },
    regulatedMaterial: true,
  });
  ok(!suspended.allowed);

  const disqualified = evaluateSupplierQualityGate({
    profile: { status: "disqualified" },
    materialQualification: { qualificationStatus: "qualified" },
    regulatedMaterial: true,
  });
  ok(!disqualified.allowed);

  const expired = evaluateSupplierQualityGate({
    profile: { status: "expired" },
    materialQualification: { qualificationStatus: "qualified" },
    regulatedMaterial: true,
    allowExpiredException: false,
  });
  ok(!expired.allowed);

  const materialBlocked = evaluateSupplierQualityGate({
    profile: { status: "approved" },
    materialQualification: { qualificationStatus: "suspended" },
    regulatedMaterial: true,
  });
  ok(!materialBlocked.allowed);

  const conditional = evaluateSupplierQualityGate({
    profile: { status: "approved" },
    materialQualification: { qualificationStatus: "conditional" },
    regulatedMaterial: true,
    allowConditional: true,
  });
  ok(conditional.allowed);
  ok(conditional.warnings.length > 0);

  const risk = calculateSupplierRisk({
    materialCriticality: 8,
    productImpact: 8,
    regulatoryImpact: 8,
    supplierHistory: 8,
    geographicRisk: 8,
    manufacturingComplexity: 8,
    qualityPerformance: 8,
    auditHistory: 8,
    certificateStatus: 8,
    changeHistory: 8,
  });
  ok(risk.riskScore > 0);
  ok(["critical", "high", "medium", "low"].includes(risk.riskLevel));
  ok(risk.version);

  const score = calculateSupplierScore({ quality: 90, delivery: 80, documentation: 70, compliance: 85, service: 75 });
  ok(score.overallScore > 0);
  ok(score.method === "weighted_average");

  const expiredStatus = calculateExpiryStatus("2020-01-01", new Date("2026-09-05"));
  strictEqual(expiredStatus.status, "expired");
  const soon = calculateExpiryStatus("2026-09-20", new Date("2026-09-05"));
  strictEqual(soon.status, "expiring_soon");

  strictEqual(calculateQualificationStatus({ status: "approved", expiryDate: "2020-01-01" }, new Date("2026-09-05")), "expired");
  strictEqual(calculateRequalificationStatus({ status: "planning", dueDate: "2020-01-01" }, new Date("2026-09-05")), "overdue");

  const performance = calculateSupplierPerformance({ receipts: 10, accepted: 8, rejected: 2, oos: 1, oot: 1 });
  strictEqual(performance.rejectionRate, 20);

  const qualificationNumber = formatDocumentNumber({
    prefix: "SUP-Q",
    separator: "-",
    financialYear: "2026",
    currentNumber: 1,
    numberLength: 5,
  });
  strictEqual(qualificationNumber, "SUP-Q-2026-00001");
  const auditNumber = formatDocumentNumber({
    prefix: "SUP-AUD",
    separator: "-",
    financialYear: "2026",
    currentNumber: 1,
    numberLength: 5,
  });
  strictEqual(auditNumber, "SUP-AUD-2026-00001");

  const signature = electronicSignature(
    { uid: "qa-user", email: "qa@example.com", role: "qa" } as SessionPayload,
    "qualification_approve",
    "Reviewed"
  );
  ok(signature.signatureReference);
  ok(!("password" in signature));
  ok(signature.signedBy === "qa-user");

  let locked = false;
  try {
    assertOpen("closed", "audit");
  } catch {
    locked = true;
  }
  ok(locked);

  return "supplier-quality self-tests passed";
}

console.log(runSupplierQualitySelfTests());
