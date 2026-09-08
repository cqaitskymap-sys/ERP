import { roundQuantity } from "@/lib/inventory/keys";
import type { MaterialRequirementLine } from "@/types/production";

export function calculateMaterialRequirements(input: {
  bomBatchSize: number;
  orderBatchSize: number;
  items: Array<{
    materialId: string;
    quantity: number;
    uom: string;
    wastageAllowance?: number;
    materialStage?: string;
    sequence?: number;
  }>;
}): MaterialRequirementLine[] {
  const bomSize = roundQuantity(input.bomBatchSize);
  const orderSize = roundQuantity(input.orderBatchSize);
  if (bomSize <= 0) throw new Error("BOM batch size must be greater than zero.");
  if (orderSize <= 0) throw new Error("Order batch size must be greater than zero.");
  const scale = orderSize / bomSize;
  return input.items.map((item) => {
    const perBatch = roundQuantity(item.quantity);
    const wastage = Math.max(0, Number(item.wastageAllowance || 0));
    const required = roundQuantity(perBatch * scale * (1 + wastage / 100));
    return {
      materialId: item.materialId,
      uom: item.uom,
      quantityPerBatch: perBatch,
      wastageAllowance: wastage,
      requiredQuantity: required,
      materialStage: item.materialStage,
      sequence: item.sequence,
    };
  });
}

export function calculateYield(input: {
  theoreticalQuantity: number;
  actualQuantity: number;
  acceptableMin?: number;
  acceptableMax?: number;
}) {
  const theoretical = roundQuantity(input.theoreticalQuantity);
  const actual = roundQuantity(input.actualQuantity);
  if (theoretical <= 0) throw new Error("Theoretical yield must be greater than zero.");
  const yieldPercentage = roundQuantity((actual / theoretical) * 100);
  const min = input.acceptableMin ?? 0;
  const max = input.acceptableMax ?? 1000;
  const result =
    yieldPercentage < min ? "below_limit" : yieldPercentage > max ? "above_limit" : "within_limit";
  return { theoreticalQuantity: theoretical, actualQuantity: actual, yieldPercentage, result, acceptableMin: min, acceptableMax: max };
}

export function calculateReconciliation(input: {
  issuedQuantity: number;
  returnedQuantity: number;
  consumedQuantity: number;
  wastageQuantity: number;
  expectedQuantity: number;
}) {
  const issued = roundQuantity(input.issuedQuantity);
  const returned = roundQuantity(input.returnedQuantity);
  const consumed = roundQuantity(input.consumedQuantity);
  const wastage = roundQuantity(input.wastageQuantity);
  const expected = roundQuantity(input.expectedQuantity);
  const actual = roundQuantity(issued - returned);
  const accounted = roundQuantity(consumed + wastage);
  const difference = roundQuantity(actual - accounted);
  const expectedDifference = roundQuantity(expected - accounted);
  const status = Math.abs(difference) < 0.0001 && Math.abs(expectedDifference) < 0.0001 ? "reconciled" : "variance";
  return { issued, returned, consumed, wastage, expected, actual, accounted, difference, status };
}
