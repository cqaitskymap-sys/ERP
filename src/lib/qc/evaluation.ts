import type { OverallTestResult, TestEvaluation } from "@/types/qc";

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function asNumber(value: unknown) {
  const raw = String(value ?? "").replace(/%/g, "").trim();
  if (!raw) return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

export function evaluateTestResult(input: {
  testType: string;
  enteredResult?: unknown;
  calculatedResult?: unknown;
  minimum?: unknown;
  maximum?: unknown;
  target?: unknown;
  acceptanceCriteria?: unknown;
}): TestEvaluation {
  const result = input.calculatedResult ?? input.enteredResult;
  if (result === undefined || result === null || String(result).trim() === "") {
    return { outcome: "pending", reason: "Result has not been entered." };
  }

  const type = normalize(input.testType) || "numeric";
  const textResult = normalize(result);
  const criteria = normalize(input.acceptanceCriteria);
  const target = normalize(input.target);

  if (type === "numeric" || type === "quantitative" || type === "calculated") {
    const value = asNumber(result);
    if (value === null) return { outcome: "invalid", reason: "Numeric result is required." };
    const min = asNumber(input.minimum);
    const max = asNumber(input.maximum);
    if (min !== null && value < min) return { outcome: "fail", reason: `Result ${value} is below minimum ${min}.` };
    if (max !== null && value > max) return { outcome: "fail", reason: `Result ${value} is above maximum ${max}.` };
    if (min === null && max === null && target && asNumber(target) !== value) {
      return { outcome: "fail", reason: `Result ${value} does not match target ${target}.` };
    }
    return { outcome: "pass", reason: "Result is within configured limits." };
  }

  if (type === "boolean") {
    const passValues = new Set(["pass", "true", "yes", "1", "complies"]);
    const failValues = new Set(["fail", "false", "no", "0", "does not comply", "does_not_comply"]);
    if (passValues.has(textResult)) return { outcome: "pass", reason: "Boolean result passed." };
    if (failValues.has(textResult)) return { outcome: "fail", reason: "Boolean result failed." };
    return { outcome: "invalid", reason: "Boolean result must be pass or fail." };
  }

  if (type === "qualitative" || type === "text") {
    const accepted = (criteria || target)
      .split(/[|,;/]/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (!accepted.length) {
      return { outcome: "pending", reason: "Acceptance criteria are not configured." };
    }
    if (accepted.some((item) => item === textResult || textResult.includes(item))) {
      return { outcome: "pass", reason: "Result matches configured acceptance criteria." };
    }
    return { outcome: "fail", reason: "Result does not match configured acceptance criteria." };
  }

  return { outcome: "invalid", reason: `Unsupported test type "${input.testType}".` };
}

export function evaluateOverallResult(
  lines: Array<{ outcome: string; mandatory?: boolean }>
): OverallTestResult {
  let passed = 0;
  let failed = 0;
  let pending = 0;
  let invalid = 0;
  for (const line of lines) {
    if (line.outcome === "pass") passed += 1;
    else if (line.outcome === "fail") failed += 1;
    else if (line.outcome === "invalid") invalid += 1;
    else pending += 1;
  }
  const mandatoryFails = lines.some((line) => line.mandatory !== false && line.outcome === "fail");
  const mandatoryPending = lines.some((line) => line.mandatory !== false && (line.outcome === "pending" || line.outcome === "invalid"));
  const overall = mandatoryFails ? "fail" : mandatoryPending ? "pending" : "pass";
  return { passed, failed, pending, invalid, overall };
}

export function applyCalculation(expression: string | undefined, entered: unknown) {
  if (!expression) return entered;
  const value = asNumber(entered);
  if (value === null) return entered;
  const formula = expression.replaceAll("{result}", String(value)).replaceAll("{value}", String(value));
  if (!/^[\d+\-*/().\s]+$/.test(formula)) {
    throw new Error("Calculated results must use a numeric expression.");
  }
  const computed = Function(`"use strict"; return (${formula});`)();
  if (typeof computed !== "number" || !Number.isFinite(computed)) {
    throw new Error("Calculated result is not a valid number.");
  }
  return Math.round(computed * 10000) / 10000;
}
