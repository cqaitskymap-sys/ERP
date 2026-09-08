import { strictEqual, ok, deepEqual } from "node:assert/strict";
import { formatBatchNumber, plannedBatchCount } from "@/lib/production/batch-number";
import { checkCustomerEligibility, checkEquipmentEligibility, checkOperatorEligibility, checkProductEligibility } from "@/lib/production/eligibility";
import { calculateMaterialRequirements, calculateReconciliation, calculateYield } from "@/lib/production/requirements";
import { BOM_TRANSITIONS, canTransition, MO_TRANSITIONS, PLAN_TRANSITIONS } from "@/lib/production/status";

export function runProductionSelfTests() {
  const now = new Date(2026, 8, 1);
  strictEqual(formatBatchNumber({ productCode: "TAB-500", sequence: 1, now }), "TAB-500-26090101");
  strictEqual(formatBatchNumber({ productCode: "TAB 500", sequence: 12, now, pattern: "{productCode}-{yyyy}{seq3}" }), "TAB500-2026012");

  strictEqual(plannedBatchCount(10000, 5000), 2);
  strictEqual(plannedBatchCount(10001, 5000, "ceil"), 3);
  strictEqual(plannedBatchCount(10001, 5000, "floor"), 2);
  strictEqual(plannedBatchCount(7499, 5000, "nearest"), 1);
  strictEqual(plannedBatchCount(7500, 5000, "nearest"), 2);
  strictEqual(plannedBatchCount(10000, 0), 0);

  const required = calculateMaterialRequirements({
    bomBatchSize: 5000,
    orderBatchSize: 25000,
    items: [{ materialId: "MAT-A", quantity: 10, uom: "KG", wastageAllowance: 0 }],
  });
  strictEqual(required[0].requiredQuantity, 50);

  const withWaste = calculateMaterialRequirements({
    bomBatchSize: 1000,
    orderBatchSize: 1000,
    items: [{ materialId: "MAT-B", quantity: 10, uom: "KG", wastageAllowance: 5 }],
  });
  strictEqual(withWaste[0].requiredQuantity, 10.5);

  const yieldOk = calculateYield({ theoreticalQuantity: 100, actualQuantity: 98, acceptableMin: 95, acceptableMax: 105 });
  strictEqual(yieldOk.result, "within_limit");
  strictEqual(yieldOk.yieldPercentage, 98);
  const yieldLow = calculateYield({ theoreticalQuantity: 100, actualQuantity: 90, acceptableMin: 95, acceptableMax: 105 });
  strictEqual(yieldLow.result, "below_limit");
  const yieldHigh = calculateYield({ theoreticalQuantity: 100, actualQuantity: 110, acceptableMin: 95, acceptableMax: 105 });
  strictEqual(yieldHigh.result, "above_limit");

  const reconOk = calculateReconciliation({
    issuedQuantity: 100,
    returnedQuantity: 5,
    consumedQuantity: 90,
    wastageQuantity: 5,
    expectedQuantity: 95,
  });
  strictEqual(reconOk.status, "reconciled");
  const reconVar = calculateReconciliation({
    issuedQuantity: 100,
    returnedQuantity: 0,
    consumedQuantity: 80,
    wastageQuantity: 5,
    expectedQuantity: 100,
  });
  strictEqual(reconVar.status, "variance");
  ok(Math.abs(reconVar.difference) > 0);

  ok(!checkProductEligibility({ product: { status: "inactive", productType: "finished" } }).eligible);
  ok(checkProductEligibility({ product: { status: "active", productType: "finished" } }).eligible);
  ok(!checkCustomerEligibility({ customer: { status: "blocked" } }).eligible);
  ok(!checkCustomerEligibility({ customer: { status: "active" }, requireMapping: true }).eligible);
  ok(checkCustomerEligibility({ customer: { status: "active" }, mapping: { status: "active" }, requireMapping: true }).eligible);
  ok(!checkEquipmentEligibility({ equipment: { status: "under_maintenance" } }).eligible);
  ok(!checkEquipmentEligibility({ equipment: { status: "active", qualificationStatus: "unqualified" } }).eligible);
  ok(!checkEquipmentEligibility({ equipment: { status: "active", qualificationStatus: "qualified", calibrationStatus: "expired" } }).eligible);
  ok(checkEquipmentEligibility({ equipment: { status: "active", qualificationStatus: "qualified", calibrationStatus: "current" } }).eligible);
  ok(!checkOperatorEligibility({ user: { status: "inactive" } }).eligible);
  ok(checkOperatorEligibility({ user: { status: "active" } }).eligible);

  ok(canTransition(PLAN_TRANSITIONS, "draft", "submitted"));
  ok(canTransition(PLAN_TRANSITIONS, "submitted", "under_review"));
  ok(!canTransition(PLAN_TRANSITIONS, "completed", "draft"));
  ok(canTransition(BOM_TRANSITIONS, "draft", "under_review"));
  ok(canTransition(BOM_TRANSITIONS, "approved", "effective"));
  ok(!canTransition(BOM_TRANSITIONS, "effective", "draft"));
  ok(!canTransition(BOM_TRANSITIONS, "superseded", "effective"));
  ok(canTransition(MO_TRANSITIONS, "approved", "ready"));
  ok(canTransition(MO_TRANSITIONS, "completed", "qc_pending"));
  ok(!canTransition(MO_TRANSITIONS, "qc_pending", "released"));
  ok(canTransition(MO_TRANSITIONS, "qa_pending", "released"));
  ok(canTransition(MO_TRANSITIONS, "qa_pending", "held"));
  ok(canTransition(MO_TRANSITIONS, "qa_pending", "rejected"));
  ok(!canTransition(MO_TRANSITIONS, "released", "qa_pending"));

  deepEqual(BOM_TRANSITIONS.effective, ["superseded", "obsolete"]);
  return "production self-tests passed";
}

console.log(runProductionSelfTests());
