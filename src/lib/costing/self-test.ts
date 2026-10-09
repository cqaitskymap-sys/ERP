import { strictEqual, ok, deepEqual } from "node:assert/strict";
import {
  allocateManufacturingOverhead,
  assembleBatchCostBreakdown,
  calculateCostVariances,
  calculateLineCost,
  calculateProductStandardCost,
  calculateProfitability,
  calculateYieldMetrics,
  detectDuplicateSourceLines,
  resolveOutputQuantity,
  validateCostingCompleteness,
  calculateBatchUnitCost,
} from "@/lib/costing/calculate";
import { canTransition, BATCH_COSTING_TRANSITIONS, STANDARD_TRANSITIONS, isFinalizedLocked } from "@/lib/costing/status";
import { money } from "@/lib/finance/money";

export function runCostingSelfTests() {
  const line = calculateLineCost({
    quantity: 10,
    unitCost: 12.5,
    componentType: "raw_material",
    description: "API",
    dataQuality: "actual",
  });
  strictEqual(line.totalCost, 125);

  const standard = calculateProductStandardCost({
    materialLines: [
      { quantity: 100, unitCost: 10, isPackaging: false },
      { quantity: 20, unitCost: 5, isPackaging: true },
    ],
    laborHours: 8,
    laborRate: 50,
    machineHours: 4,
    machineRate: 100,
    overheadAmount: 200,
    qualityAmount: 50,
    standardBatchSize: 1000,
    standardYieldPercent: 95,
  });
  strictEqual(standard.materialCost, 1000);
  strictEqual(standard.packagingCost, 100);
  strictEqual(standard.laborCost, 400);
  strictEqual(standard.machineCost, 400);
  strictEqual(standard.totalBatchCost, 2150);
  strictEqual(standard.outputQuantity, 950);
  ok(standard.costPerUnit > 0);

  const breakdown = assembleBatchCostBreakdown({
    lines: [
      line,
      calculateLineCost({
        quantity: 2,
        unitCost: 10,
        componentType: "packaging",
        description: "Bottle",
        dataQuality: "actual",
      }),
      calculateLineCost({
        quantity: 1,
        unitCost: 50,
        componentType: "credit",
        description: "Return credit",
        dataQuality: "actual",
      }),
    ],
    outputQuantity: 100,
  });
  strictEqual(breakdown.totalBatchCost, 95);
  strictEqual(breakdown.costPerUnit, 0.95);

  const allocation = allocateManufacturingOverhead({
    poolAmount: 1000,
    basisQuantity: 250,
    totalBasisQuantity: 1000,
  });
  strictEqual(allocation.allocatedAmount, 250);

  const yieldMetrics = calculateYieldMetrics({
    plannedQuantity: 1000,
    actualQuantity: 920,
    standardYieldPercent: 95,
    standardWastagePercent: 2,
    actualWastageQuantity: 40,
  });
  strictEqual(yieldMetrics.actualYieldPercent, 92);
  ok(yieldMetrics.yieldVarianceQuantity < 0);

  const variances = calculateCostVariances({
    actualMaterialQty: 110,
    actualMaterialPrice: 12,
    standardMaterialQty: 100,
    standardMaterialPrice: 10,
    actualTotal: 1500,
    standardTotal: 1200,
    actualUnitCost: 1.5,
    standardUnitCost: 1.2,
  });
  // price var = (12-10)*110 = 220; usage = (110-100)*10 = 100
  strictEqual(variances.rows.find((r) => r.type === "material_price")?.amount, 220);
  strictEqual(variances.rows.find((r) => r.type === "material_usage")?.amount, 100);

  const saleable = resolveOutputQuantity({
    producedQuantity: 1000,
    releasedQuantity: 980,
    rejectedQuantity: 30,
    policy: "saleable",
  });
  strictEqual(saleable, 950);

  const completeness = validateCostingCompleteness({
    hasMaterial: true,
    hasOutput: true,
    requireLabor: true,
    hasLabor: false,
  });
  ok(!completeness.complete);
  ok(completeness.missingComponents.includes("labor_hours"));

  let dupThrew = false;
  try {
    detectDuplicateSourceLines([
      { sourceCollection: "a", sourceId: "1", componentType: "raw_material" },
      { sourceCollection: "a", sourceId: "1", componentType: "raw_material" },
    ]);
  } catch {
    dupThrew = true;
  }
  ok(dupThrew);

  const profit = calculateProfitability({
    netSales: 10000,
    discounts: 500,
    productCost: 4000,
    freightCost: 200,
    marginQuality: "actual",
  });
  strictEqual(profit.revenue, 9500);
  strictEqual(profit.grossProfit, 5300);
  ok(!profit.isNetProfit);

  strictEqual(calculateBatchUnitCost(1000, 500), 2);
  ok(canTransition(BATCH_COSTING_TRANSITIONS, "calculated", "validation"));
  ok(canTransition(BATCH_COSTING_TRANSITIONS, "approved", "finalized"));
  ok(!canTransition(BATCH_COSTING_TRANSITIONS, "finalized", "draft"));
  ok(canTransition(STANDARD_TRANSITIONS, "approved", "finalized"));
  ok(isFinalizedLocked("finalized"));
  ok(!isFinalizedLocked("calculated"));
  deepEqual(BATCH_COSTING_TRANSITIONS.finalized, ["reconciled", "superseded"]);

  strictEqual(money(10.126), 10.13);
  return "costing self-tests passed";
}

console.log(runCostingSelfTests());
