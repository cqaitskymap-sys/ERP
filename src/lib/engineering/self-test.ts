import { strictEqual, ok, deepEqual } from "node:assert/strict";
import {
  addDays,
  assessEquipmentCriticality,
  calculateEquipmentDowntimeMinutes,
  calculateMTBF,
  calculateMTTR,
  calculateMaintenanceCost,
  calculateNextCalibrationDueDate,
  calculateNextDueDate,
  complianceRate,
  daysUntil,
  evaluateCalibrationResults,
  evaluateUtilityLimits,
  scheduleTaskKey,
} from "@/lib/engineering/calculate";
import {
  canTransition,
  WORK_ORDER_TRANSITIONS,
  CALIBRATION_TRANSITIONS,
  EQUIPMENT_TRANSITIONS,
  isClosedWorkOrder,
} from "@/lib/engineering/status";

export function runEngineeringSelfTests() {
  strictEqual(addDays("2026-01-01", 30), "2026-01-31");
  strictEqual(calculateNextDueDate({ fromDate: "2026-01-01", frequency: "monthly" }), "2026-01-31");
  strictEqual(
    calculateNextCalibrationDueDate({ calibrationDate: "2026-01-15", frequency: "yearly" }),
    "2027-01-15"
  );
  ok(daysUntil("2026-10-16", "2026-10-09") === 7);

  const risk = assessEquipmentCriticality({
    productQualityImpact: 5,
    patientSafetyImpact: 4,
    dataIntegrityImpact: 3,
    processImpact: 4,
    businessContinuityImpact: 3,
    failureProbability: 3,
    failureSeverity: 4,
    detectability: 2,
  });
  strictEqual(risk.classification, "critical");
  ok(risk.riskScore >= 100);

  const pass = evaluateCalibrationResults({
    readings: [{ point: "0", asFound: 0.1, asLeft: 0, lowerLimit: -0.5, upperLimit: 0.5 }],
  });
  strictEqual(pass.outcome, "passed");

  const oot = evaluateCalibrationResults({
    readings: [{ point: "0", asFound: 2, asLeft: 0.1, lowerLimit: -0.5, upperLimit: 0.5 }],
  });
  strictEqual(oot.outcome, "out_of_tolerance");

  const failLeft = evaluateCalibrationResults({
    readings: [{ point: "0", asFound: 0, asLeft: 2, lowerLimit: -0.5, upperLimit: 0.5 }],
  });
  strictEqual(failLeft.outcome, "out_of_tolerance");

  strictEqual(
    calculateEquipmentDowntimeMinutes({
      downtimeStart: "2026-10-09T10:00:00.000Z",
      downtimeEnd: "2026-10-09T12:30:00.000Z",
    }),
    150
  );

  const mttr = calculateMTTR({ repairMinutes: [60, 120, 90] });
  strictEqual(mttr.mttrMinutes, 90);
  ok(mttr.reliable);

  const mtbf = calculateMTBF({
    failureTimestamps: [
      "2026-01-01T00:00:00.000Z",
      "2026-01-11T00:00:00.000Z",
      "2026-01-21T00:00:00.000Z",
      "2026-01-31T00:00:00.000Z",
    ],
  });
  strictEqual(mtbf.mtbfHours, 240);
  ok(mtbf.reliable);

  const cost = calculateMaintenanceCost({ laborCost: 100, sparePartCost: 50, serviceProviderCost: 25 });
  strictEqual(cost.totalCost, 175);
  strictEqual(cost.costQuality, "actual");

  const util = evaluateUtilityLimits({ value: 25, lowerLimit: 18, upperLimit: 22 });
  ok(!util.withinLimits);
  strictEqual(util.excursionType, "above_limit");

  strictEqual(complianceRate(8, 10), 80);
  strictEqual(scheduleTaskKey("plan1", "2026-10-09"), "plan1:2026-10-09");

  ok(canTransition(WORK_ORDER_TRANSITIONS, "draft", "submitted"));
  ok(canTransition(WORK_ORDER_TRANSITIONS, "work_completed", "engineering_review"));
  ok(!canTransition(WORK_ORDER_TRANSITIONS, "closed", "draft"));
  ok(canTransition(CALIBRATION_TRANSITIONS, "results_review", "out_of_tolerance"));
  ok(canTransition(EQUIPMENT_TRANSITIONS, "in_service", "under_maintenance"));
  ok(isClosedWorkOrder("closed"));
  deepEqual(WORK_ORDER_TRANSITIONS.closed, ["reopened"]);

  // Duplicate schedule key stability
  strictEqual(scheduleTaskKey("a", "2026-01-01T12:00:00Z"), scheduleTaskKey("a", "2026-01-01"));

  return "engineering self-tests passed";
}

console.log(runEngineeringSelfTests());
