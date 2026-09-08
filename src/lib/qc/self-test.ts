import { strictEqual, ok, deepEqual } from "node:assert/strict";
import { applyCalculation, evaluateOverallResult, evaluateTestResult } from "@/lib/qc/evaluation";
import { checkAnalystEligibility, checkInstrumentEligibility, checkStandardEligibility } from "@/lib/qc/eligibility";
import { canTransition, SAMPLE_REQUEST_TRANSITIONS, SAMPLE_TRANSITIONS, SPEC_TRANSITIONS, TEST_TRANSITIONS } from "@/lib/qc/status";

export function runQcSelfTests() {
  const numericPass = evaluateTestResult({ testType: "numeric", enteredResult: 99.2, minimum: 98, maximum: 102 });
  strictEqual(numericPass.outcome, "pass");
  const numericFail = evaluateTestResult({ testType: "numeric", enteredResult: 97.1, minimum: 98, maximum: 102 });
  strictEqual(numericFail.outcome, "fail");
  const pending = evaluateTestResult({ testType: "numeric", enteredResult: "" });
  strictEqual(pending.outcome, "pending");
  const invalid = evaluateTestResult({ testType: "numeric", enteredResult: "white" });
  strictEqual(invalid.outcome, "invalid");

  const textPass = evaluateTestResult({ testType: "text", enteredResult: "White powder", acceptanceCriteria: "white powder" });
  strictEqual(textPass.outcome, "pass");
  const qualitativeFail = evaluateTestResult({ testType: "qualitative", enteredResult: "Does Not Comply", acceptanceCriteria: "complies" });
  strictEqual(qualitativeFail.outcome, "fail");
  const booleanPass = evaluateTestResult({ testType: "boolean", enteredResult: "pass" });
  strictEqual(booleanPass.outcome, "pass");

  const overallPending = evaluateOverallResult([
    { outcome: "pass", mandatory: true },
    { outcome: "pending", mandatory: true },
  ]);
  strictEqual(overallPending.overall, "pending");
  const overallFail = evaluateOverallResult([
    { outcome: "pass", mandatory: true },
    { outcome: "fail", mandatory: true },
  ]);
  strictEqual(overallFail.overall, "fail");
  const overallPass = evaluateOverallResult([
    { outcome: "pass", mandatory: true },
    { outcome: "fail", mandatory: false },
  ]);
  strictEqual(overallPass.overall, "pass");
  deepEqual(
    { passed: 1, failed: 0, pending: 0, invalid: 0, overall: "pass" },
    evaluateOverallResult([{ outcome: "pass", mandatory: true }])
  );

  strictEqual(applyCalculation("{result} * 2", 10), 20);
  try {
    applyCalculation("process.exit()", 1);
    ok(false, "unsafe calculation must be rejected");
  } catch {
    ok(true);
  }

  ok(canTransition(SAMPLE_REQUEST_TRANSITIONS, "draft", "requested"));
  ok(!canTransition(SAMPLE_REQUEST_TRANSITIONS, "closed", "draft"));
  ok(canTransition(SAMPLE_TRANSITIONS, "sampled", "received"));
  ok(!canTransition(SAMPLE_TRANSITIONS, "disposed", "testing"));
  ok(canTransition(TEST_TRANSITIONS, "in_testing", "review_pending"));
  ok(!canTransition(TEST_TRANSITIONS, "completed", "in_testing"));
  ok(canTransition(SPEC_TRANSITIONS, "approved", "effective"));
  ok(!canTransition(SPEC_TRANSITIONS, "effective", "draft"));

  ok(!checkAnalystEligibility({ status: "inactive" }).eligible);
  ok(checkAnalystEligibility({ status: "active" }).eligible);
  ok(!checkInstrumentEligibility({ status: "active", calibrationStatus: "expired" }).eligible);
  ok(!checkInstrumentEligibility({ status: "active", calibrationStatus: "current", calibrationDueDate: "2020-01-01" }).eligible);
  ok(checkInstrumentEligibility({ status: "active", calibrationStatus: "current", qualificationStatus: "qualified" }).eligible);
  ok(!checkStandardEligibility({ status: "available", expiryDate: "2020-01-01" }).eligible);
  ok(checkStandardEligibility({ status: "available", expiryDate: "2099-01-01" }).eligible);
  ok(!checkStandardEligibility({ status: "expired" }).eligible);

  return "qc self-tests passed";
}

console.log(runQcSelfTests());
