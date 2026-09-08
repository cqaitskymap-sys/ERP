import { isUsableForNewTransactions } from "@/lib/masters/permissions";

export function checkAnalystEligibility(user?: Record<string, unknown> | null) {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!user) {
    warnings.push("Analyst record was not readable. Training will be enforced by a future LMS module.");
    return { eligible: true, reasons, warnings };
  }
  if (String(user.status || "") !== "active") reasons.push("Only active users can be assigned laboratory tests.");
  const training = String(user.trainingStatus || user.qualificationStatus || "");
  if (training && !["qualified", "trained", "current", "authorized"].includes(training)) {
    reasons.push(`Analyst training status "${training}" is not sufficient.`);
  }
  if (!training) warnings.push("Training eligibility is not recorded.");
  return { eligible: reasons.length === 0, reasons, warnings };
}

export function checkInstrumentEligibility(instrument?: Record<string, unknown> | null) {
  const reasons: string[] = [];
  if (!instrument) return { eligible: false, reasons: ["Instrument was not found."] };
  const status = String(instrument.status || "");
  if (!["active"].includes(status) || !isUsableForNewTransactions(status)) {
    reasons.push(`Instrument status "${status || "unknown"}" cannot be used.`);
  }
  const calibration = String(instrument.calibrationStatus || "");
  if (["expired", "overdue"].includes(calibration)) reasons.push("Instrument calibration is expired.");
  const due = String(instrument.calibrationDueDate || "");
  if (due && due < new Date().toISOString().slice(0, 10)) reasons.push("Instrument calibration due date has passed.");
  const qualification = String(instrument.qualificationStatus || "");
  if (qualification && !["qualified", "approved"].includes(qualification)) {
    reasons.push(`Instrument qualification "${qualification}" is not valid.`);
  }
  return { eligible: reasons.length === 0, reasons };
}

export function checkStandardEligibility(standard?: Record<string, unknown> | null) {
  const reasons: string[] = [];
  if (!standard) return { eligible: false, reasons: ["Reference standard was not found."] };
  const status = String(standard.status || "");
  if (status !== "available") reasons.push(`Reference standard status "${status || "unknown"}" cannot be used.`);
  const expiry = String(standard.expiryDate || "");
  if (expiry && expiry < new Date().toISOString().slice(0, 10)) reasons.push("Reference standard has expired.");
  return { eligible: reasons.length === 0, reasons };
}
