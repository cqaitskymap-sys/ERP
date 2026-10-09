import { addMoney, money, fromCents, toCents } from "@/lib/finance/money";
import { FREQUENCY_DAYS } from "@/lib/engineering/config";
import { fail, text } from "@/lib/engineering/helpers";

export function addDays(dateIso: string, days: number) {
  const date = new Date(`${dateIso.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) fail("Invalid date for schedule calculation.");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calculateNextDueDate(options: {
  fromDate: string;
  frequency: string;
  customIntervalDays?: number;
}) {
  const from = options.fromDate.slice(0, 10);
  if (options.frequency === "custom") {
    const days = Number(options.customIntervalDays || 0);
    if (days <= 0) fail("Custom interval days must be greater than zero.");
    return addDays(from, days);
  }
  const days = FREQUENCY_DAYS[options.frequency];
  if (!days) fail(`Unsupported maintenance frequency "${options.frequency}".`);
  return addDays(from, days);
}

export function calculateNextCalibrationDueDate(options: {
  calibrationDate: string;
  frequency: string;
  customIntervalDays?: number;
}) {
  return calculateNextDueDate({
    fromDate: options.calibrationDate,
    frequency: options.frequency,
    customIntervalDays: options.customIntervalDays,
  });
}

export function daysUntil(dueDate: string, asOf = new Date().toISOString().slice(0, 10)) {
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00.000Z`).getTime();
  const now = new Date(`${asOf.slice(0, 10)}T00:00:00.000Z`).getTime();
  return Math.round((due - now) / 86400000);
}

export function assessEquipmentCriticality(options: {
  productQualityImpact: number;
  patientSafetyImpact: number;
  dataIntegrityImpact: number;
  processImpact: number;
  businessContinuityImpact: number;
  failureProbability: number;
  failureSeverity: number;
  detectability?: number;
}) {
  const scores = [
    options.productQualityImpact,
    options.patientSafetyImpact,
    options.dataIntegrityImpact,
    options.processImpact,
    options.businessContinuityImpact,
    options.failureProbability,
    options.failureSeverity,
  ].map((n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 1 || v > 5) fail("Risk scores must be integers from 1 to 5.");
    return v;
  });
  const detectability =
    options.detectability == null
      ? 1
      : (() => {
          const v = Number(options.detectability);
          if (!Number.isFinite(v) || v < 1 || v > 5) fail("Detectability must be from 1 to 5.");
          return v;
        })();
  const impactMax = Math.max(...scores.slice(0, 5));
  const riskScore = impactMax * options.failureProbability * options.failureSeverity * detectability;
  let classification: "critical" | "major" | "minor" | "non_critical" = "non_critical";
  if (riskScore >= 100 || impactMax >= 5) classification = "critical";
  else if (riskScore >= 40 || impactMax >= 4) classification = "major";
  else if (riskScore >= 12) classification = "minor";
  return { riskScore, classification, impactMax, detectability };
}

export function evaluateCalibrationResults(options: {
  readings: Array<{
    point: string;
    asFound?: unknown;
    asLeft?: unknown;
    lowerLimit: unknown;
    upperLimit: unknown;
  }>;
}) {
  if (!options.readings.length) fail("Calibration readings are required.");
  const details = options.readings.map((row) => {
    const lower = money(row.lowerLimit);
    const upper = money(row.upperLimit);
    if (lower > upper) fail(`Invalid limits for point ${row.point}.`);
    const asFound = row.asFound == null || row.asFound === "" ? null : money(row.asFound);
    const asLeft = row.asLeft == null || row.asLeft === "" ? null : money(row.asLeft);
    const foundOk = asFound == null ? null : asFound >= lower && asFound <= upper;
    const leftOk = asLeft == null ? null : asLeft >= lower && asLeft <= upper;
    return {
      point: row.point,
      asFound,
      asLeft,
      lowerLimit: lower,
      upperLimit: upper,
      asFoundWithinTolerance: foundOk,
      asLeftWithinTolerance: leftOk,
    };
  });
  const anyFoundOot = details.some((row) => row.asFoundWithinTolerance === false);
  const anyLeftOot = details.some((row) => row.asLeftWithinTolerance === false);
  const missingLeft = details.some((row) => row.asLeft == null);
  let outcome: "passed" | "failed" | "out_of_tolerance" = "passed";
  if (anyLeftOot || missingLeft) outcome = anyLeftOot ? "out_of_tolerance" : "failed";
  else if (anyFoundOot) outcome = "out_of_tolerance";
  return { details, outcome, anyFoundOot, anyLeftOot };
}

export function calculateEquipmentDowntimeMinutes(options: {
  downtimeStart: string;
  downtimeEnd?: string;
}) {
  const start = new Date(options.downtimeStart).getTime();
  if (Number.isNaN(start)) fail("Invalid downtime start.");
  const end = options.downtimeEnd ? new Date(options.downtimeEnd).getTime() : Date.now();
  if (Number.isNaN(end)) fail("Invalid downtime end.");
  if (end < start) fail("Downtime end cannot be before start.");
  return Math.round((end - start) / 60000);
}

export function calculateMTTR(options: { repairMinutes: number[] }) {
  const values = options.repairMinutes.filter((n) => Number.isFinite(n) && n >= 0);
  if (!values.length) return { mttrMinutes: null, sampleSize: 0, reliable: false };
  const total = values.reduce((sum, n) => sum + n, 0);
  return {
    mttrMinutes: Math.round(total / values.length),
    sampleSize: values.length,
    reliable: values.length >= 3,
  };
}

export function calculateMTBF(options: { failureTimestamps: string[] }) {
  const times = options.failureTimestamps
    .map((value) => new Date(value).getTime())
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (times.length < 2) return { mtbfHours: null, sampleSize: times.length, reliable: false };
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i += 1) gaps.push(times[i] - times[i - 1]);
  const avgMs = gaps.reduce((sum, n) => sum + n, 0) / gaps.length;
  return {
    mtbfHours: Math.round((avgMs / 3600000) * 100) / 100,
    sampleSize: gaps.length,
    reliable: gaps.length >= 3,
  };
}

export function calculateMaintenanceCost(options: {
  laborCost?: unknown;
  sparePartCost?: unknown;
  serviceProviderCost?: unknown;
  otherCost?: unknown;
  estimated?: boolean;
}) {
  const laborCost = money(options.laborCost);
  const sparePartCost = money(options.sparePartCost);
  const serviceProviderCost = money(options.serviceProviderCost);
  const otherCost = money(options.otherCost);
  return {
    laborCost,
    sparePartCost,
    serviceProviderCost,
    otherCost,
    totalCost: addMoney(laborCost, sparePartCost, serviceProviderCost, otherCost),
    costQuality: options.estimated ? ("estimated" as const) : ("actual" as const),
  };
}

export function evaluateUtilityLimits(options: {
  value: unknown;
  lowerLimit?: unknown;
  upperLimit?: unknown;
}) {
  const value = money(options.value);
  const lower = options.lowerLimit == null || options.lowerLimit === "" ? null : money(options.lowerLimit);
  const upper = options.upperLimit == null || options.upperLimit === "" ? null : money(options.upperLimit);
  if (lower != null && upper != null && lower > upper) fail("Utility lower limit cannot exceed upper limit.");
  const below = lower != null && value < lower;
  const above = upper != null && value > upper;
  return {
    value,
    lowerLimit: lower,
    upperLimit: upper,
    withinLimits: !below && !above,
    excursionType: below ? ("below_limit" as const) : above ? ("above_limit" as const) : ("none" as const),
  };
}

export function complianceRate(completed: number, due: number) {
  if (due <= 0) return null;
  return fromCents(Math.round((toCents(completed) * 10000) / due) / 100);
}

export function scheduleTaskKey(planId: string, dueDate: string) {
  return `${text(planId)}:${dueDate.slice(0, 10)}`;
}
