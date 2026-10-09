import { strictEqual, ok, deepEqual } from "node:assert/strict";
import {
  applyLeaveLedgerBalance,
  calculateEmployeePayroll,
  calculateOvertime,
  calculateStatutoryDeductions,
  calculateWorkingHours,
  datesOverlap,
  isLateArrival,
  leaveDaysInclusive,
  parseTimeToMinutes,
  pickEffectiveStatutoryRule,
  shiftsOverlap,
} from "@/lib/hr/calculate";
import {
  canTransition,
  EMPLOYMENT_TRANSITIONS,
  LEAVE_TRANSITIONS,
  PAYROLL_TRANSITIONS,
  isFinalizedPayroll,
} from "@/lib/hr/status";
import { money, toCents } from "@/lib/finance/money";

export function runHrSelfTests() {
  strictEqual(parseTimeToMinutes("09:30"), 570);
  strictEqual(parseTimeToMinutes("25:00"), null);

  const day = calculateWorkingHours({
    checkIn: "09:00",
    checkOut: "18:00",
    breakMinutes: 60,
  });
  strictEqual(day.workedMinutes, 480);
  ok(day.valid);

  const overnight = calculateWorkingHours({
    checkIn: "22:00",
    checkOut: "06:00",
    breakMinutes: 30,
    overnight: true,
  });
  strictEqual(overnight.workedMinutes, 450);

  ok(isLateArrival({ checkIn: "09:20", shiftStart: "09:00", graceMinutes: 15 }));
  ok(!isLateArrival({ checkIn: "09:10", shiftStart: "09:00", graceMinutes: 15 }));

  const ot = calculateOvertime({
    workedMinutes: 540,
    shiftMinutes: 480,
    eligible: true,
    maxOvertimeMinutes: 120,
  });
  strictEqual(ot.overtimeMinutes, 60);

  const ineligible = calculateOvertime({
    workedMinutes: 600,
    shiftMinutes: 480,
    eligible: false,
  });
  strictEqual(ineligible.overtimeMinutes, 0);

  strictEqual(leaveDaysInclusive("2026-10-01", "2026-10-03"), 3);
  ok(datesOverlap("2026-10-01", "2026-10-05", "2026-10-05", "2026-10-07"));
  ok(!datesOverlap("2026-10-01", "2026-10-03", "2026-10-04", "2026-10-07"));

  strictEqual(applyLeaveLedgerBalance({ previousBalance: 12, entryType: "usage", days: 2 }), 10);
  strictEqual(applyLeaveLedgerBalance({ previousBalance: 10, entryType: "accrual", days: 1.5 }), 11.5);

  ok(
    shiftsOverlap({
      aStart: "09:00",
      aEnd: "18:00",
      bStart: "17:00",
      bEnd: "22:00",
    })
  );

  const payroll = calculateEmployeePayroll({
    basic: 50000,
    hra: 20000,
    otherAllowances: 5000,
    employeeDeductions: 3000,
    employerContributions: 4000,
  });
  strictEqual(toCents(payroll.grossEarnings), toCents(money(75000)));
  strictEqual(toCents(payroll.netPayable), toCents(money(72000)));

  const statutory = calculateStatutoryDeductions({
    grossEarnings: 20000,
    pfEmployeeRate: 0.12,
    pfEmployerRate: 0.12,
    pfWageCeiling: 15000,
    esiEmployeeRate: 0.0075,
    esiEmployerRate: 0.0325,
    esiWageCeiling: 21000,
    professionalTax: 200,
  });
  ok(toCents(statutory.pfEmployee) === Math.round(15000 * 0.12 * 100));
  ok(statutory.requiresProfessionalReview);

  const rule = pickEffectiveStatutoryRule(
    [
      { effectiveFrom: "2025-01-01", effectiveTo: "2025-12-31" },
      { effectiveFrom: "2026-01-01", effectiveTo: null },
    ],
    "2026-10-09"
  );
  deepEqual(rule?.effectiveFrom, "2026-01-01");

  ok(canTransition(EMPLOYMENT_TRANSITIONS, "active", "notice_period"));
  ok(!canTransition(EMPLOYMENT_TRANSITIONS, "separated", "active"));
  ok(canTransition(LEAVE_TRANSITIONS, "submitted", "approved"));
  ok(canTransition(PAYROLL_TRANSITIONS, "approved", "finalized"));
  ok(isFinalizedPayroll("finalized"));
  ok(!isFinalizedPayroll("draft"));

  return "hr self-tests passed";
}

console.log(runHrSelfTests());
