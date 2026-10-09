import { addMoney, money, toCents, fromCents } from "@/lib/finance/money";

export function parseTimeToMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function calculateWorkingHours(options: {
  checkIn?: string;
  checkOut?: string;
  breakMinutes?: number;
  overnight?: boolean;
}) {
  const inMin = parseTimeToMinutes(options.checkIn || "");
  const outMin = parseTimeToMinutes(options.checkOut || "");
  if (inMin == null || outMin == null) {
    return { workedMinutes: 0, workedHours: 0, valid: false, reason: "Invalid check-in/out time." };
  }
  let diff = outMin - inMin;
  if (options.overnight || diff < 0) diff += 24 * 60;
  const breakMinutes = Math.max(0, Number(options.breakMinutes || 0));
  const workedMinutes = Math.max(0, diff - breakMinutes);
  return {
    workedMinutes,
    workedHours: Math.round((workedMinutes / 60) * 100) / 100,
    valid: true,
    reason: "",
  };
}

export function calculateOvertime(options: {
  workedMinutes: number;
  shiftMinutes: number;
  eligible?: boolean;
  maxOvertimeMinutes?: number;
}) {
  if (!options.eligible) {
    return { overtimeMinutes: 0, overtimeHours: 0, eligible: false };
  }
  const raw = Math.max(0, options.workedMinutes - options.shiftMinutes);
  const capped =
    options.maxOvertimeMinutes != null ? Math.min(raw, options.maxOvertimeMinutes) : raw;
  return {
    overtimeMinutes: capped,
    overtimeHours: Math.round((capped / 60) * 100) / 100,
    eligible: true,
  };
}

export function isLateArrival(options: {
  checkIn?: string;
  shiftStart?: string;
  graceMinutes?: number;
}) {
  const checkIn = parseTimeToMinutes(options.checkIn || "");
  const shiftStart = parseTimeToMinutes(options.shiftStart || "");
  if (checkIn == null || shiftStart == null) return false;
  const grace = Math.max(0, Number(options.graceMinutes ?? 15));
  return checkIn > shiftStart + grace;
}

export function leaveDaysInclusive(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
  return Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
}

export function datesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string) {
  return aFrom <= bTo && bFrom <= aTo;
}

export function applyLeaveLedgerBalance(options: {
  previousBalance: number;
  entryType: string;
  days: number;
}) {
  const days = Math.abs(Number(options.days) || 0);
  switch (options.entryType) {
    case "entitlement":
    case "accrual":
    case "carry_forward":
    case "adjustment":
      return Math.round((options.previousBalance + days) * 100) / 100;
    case "usage":
    case "lapse":
      return Math.round((options.previousBalance - days) * 100) / 100;
    default:
      return options.previousBalance;
  }
}

export function calculateEmployeePayroll(options: {
  basic: unknown;
  hra?: unknown;
  otherAllowances?: unknown;
  incentives?: unknown;
  overtime?: unknown;
  bonuses?: unknown;
  employeeDeductions?: unknown;
  employerContributions?: unknown;
  reimbursements?: unknown;
}) {
  const basic = money(options.basic);
  const hra = money(options.hra);
  const otherAllowances = money(options.otherAllowances);
  const incentives = money(options.incentives);
  const overtime = money(options.overtime);
  const bonuses = money(options.bonuses);
  const reimbursements = money(options.reimbursements);
  const employeeDeductions = money(options.employeeDeductions);
  const employerContributions = money(options.employerContributions);
  const grossEarnings = addMoney(basic, hra, otherAllowances, incentives, overtime, bonuses, reimbursements);
  const netPayable = money(fromCents(Math.max(0, toCents(grossEarnings) - toCents(employeeDeductions))));
  const employerTotalCost = addMoney(grossEarnings, employerContributions);
  return {
    basic,
    hra,
    otherAllowances,
    incentives,
    overtime,
    bonuses,
    reimbursements,
    grossEarnings,
    employeeDeductions,
    employerContributions,
    netPayable,
    employerTotalCost,
  };
}

/** Configurable statutory sketch — rates must come from approved rule versions, never hard-coded as law. */
export function calculateStatutoryDeductions(options: {
  grossEarnings: unknown;
  pfEmployeeRate?: number;
  pfEmployerRate?: number;
  pfWageCeiling?: unknown;
  esiEmployeeRate?: number;
  esiEmployerRate?: number;
  esiWageCeiling?: unknown;
  professionalTax?: unknown;
  tds?: unknown;
}) {
  const gross = toCents(money(options.grossEarnings));
  const pfCeiling = options.pfWageCeiling != null ? toCents(money(options.pfWageCeiling)) : gross;
  const pfBase = Math.min(gross, pfCeiling);
  const pfEmployeeRate = Number(options.pfEmployeeRate ?? 0);
  const pfEmployerRate = Number(options.pfEmployerRate ?? 0);
  const pfEmployee = Math.round(pfBase * pfEmployeeRate);
  const pfEmployer = Math.round(pfBase * pfEmployerRate);

  const esiCeiling = options.esiWageCeiling != null ? toCents(money(options.esiWageCeiling)) : Infinity;
  const esiEligible = gross <= esiCeiling;
  const esiEmployee = esiEligible ? Math.round(gross * Number(options.esiEmployeeRate ?? 0)) : 0;
  const esiEmployer = esiEligible ? Math.round(gross * Number(options.esiEmployerRate ?? 0)) : 0;

  const professionalTax = toCents(money(options.professionalTax));
  const tds = toCents(money(options.tds));
  const employeeTotal = pfEmployee + esiEmployee + professionalTax + tds;
  const employerTotal = pfEmployer + esiEmployer;

  return {
    pfEmployee: money(fromCents(pfEmployee)),
    pfEmployer: money(fromCents(pfEmployer)),
    esiEmployee: money(fromCents(esiEmployee)),
    esiEmployer: money(fromCents(esiEmployer)),
    professionalTax: money(fromCents(professionalTax)),
    tds: money(fromCents(tds)),
    employeeDeductions: money(fromCents(employeeTotal)),
    employerContributions: money(fromCents(employerTotal)),
    requiresProfessionalReview: true,
    note: "Statutory amounts use configured rule versions; confirm with a qualified payroll/tax professional before filing.",
  };
}

export function pickEffectiveStatutoryRule<T extends { effectiveFrom: string; effectiveTo?: string | null }>(
  rules: T[],
  asOfDate: string
) {
  const eligible = rules
    .filter((rule) => rule.effectiveFrom <= asOfDate && (!rule.effectiveTo || rule.effectiveTo >= asOfDate))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return eligible[0] || null;
}

export function shiftsOverlap(options: {
  aStart: string;
  aEnd: string;
  aOvernight?: boolean;
  bStart: string;
  bEnd: string;
  bOvernight?: boolean;
}) {
  const a = calculateWorkingHours({
    checkIn: options.aStart,
    checkOut: options.aEnd,
    overnight: options.aOvernight,
    breakMinutes: 0,
  });
  const b = calculateWorkingHours({
    checkIn: options.bStart,
    checkOut: options.bEnd,
    overnight: options.bOvernight,
    breakMinutes: 0,
  });
  if (!a.valid || !b.valid) return false;
  const aStart = parseTimeToMinutes(options.aStart)!;
  let aEnd = parseTimeToMinutes(options.aEnd)!;
  const bStart = parseTimeToMinutes(options.bStart)!;
  let bEnd = parseTimeToMinutes(options.bEnd)!;
  if (options.aOvernight || aEnd <= aStart) aEnd += 24 * 60;
  if (options.bOvernight || bEnd <= bStart) bEnd += 24 * 60;
  return aStart < bEnd && bStart < aEnd;
}
