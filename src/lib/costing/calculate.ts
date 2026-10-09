import { addMoney, fromCents, money, multiplyMoney, subtractMoney, toCents } from "@/lib/finance/money";
import { fail, text } from "@/lib/costing/helpers";
import type {
  BatchCostBreakdown,
  CostComponentType,
  CostDataQuality,
  CostLineResult,
  VarianceType,
} from "@/types/costing";

export function validateNonNegative(label: string, value: unknown) {
  const n = money(value);
  if (n < 0) fail(`${label} cannot be negative.`);
  return n;
}

export function calculateLineCost(options: {
  quantity: unknown;
  unitCost: unknown;
  componentType: CostComponentType;
  description: string;
  uom?: string;
  sourceCollection?: string;
  sourceId?: string;
  materialId?: string;
  valuationBasis?: string;
  dataQuality?: CostDataQuality;
  currency?: string;
}): CostLineResult {
  const quantity = validateNonNegative("Quantity", options.quantity);
  const unitCost = validateNonNegative("Unit cost", options.unitCost);
  return {
    componentType: options.componentType,
    sourceCollection: options.sourceCollection,
    sourceId: options.sourceId,
    materialId: options.materialId,
    description: options.description,
    quantity,
    uom: options.uom || "",
    unitCost,
    totalCost: multiplyMoney(quantity, unitCost),
    valuationBasis: options.valuationBasis || "unknown",
    dataQuality: options.dataQuality || "provisional",
    currency: options.currency || "INR",
  };
}

export function sumComponent(lines: CostLineResult[], type: CostComponentType | CostComponentType[]) {
  const types = Array.isArray(type) ? type : [type];
  return lines
    .filter((line) => types.includes(line.componentType))
    .reduce((sum, line) => addMoney(sum, line.totalCost), 0);
}

export function resolveOutputQuantity(options: {
  producedQuantity?: unknown;
  releasedQuantity?: unknown;
  saleableQuantity?: unknown;
  rejectedQuantity?: unknown;
  policy: "produced" | "released" | "saleable";
}) {
  const produced = validateNonNegative("Produced quantity", options.producedQuantity);
  const released = options.releasedQuantity != null ? validateNonNegative("Released quantity", options.releasedQuantity) : produced;
  const rejected = validateNonNegative("Rejected quantity", options.rejectedQuantity);
  const saleable =
    options.saleableQuantity != null
      ? validateNonNegative("Saleable quantity", options.saleableQuantity)
      : Math.max(0, subtractMoney(released, rejected));

  if (options.policy === "saleable") return saleable;
  if (options.policy === "released") return released;
  return produced;
}

export function calculateBatchUnitCost(totalBatchCost: unknown, outputQuantity: unknown) {
  const total = money(totalBatchCost);
  const qty = money(outputQuantity);
  if (qty <= 0) fail("Output quantity must be greater than zero for unit cost.");
  return fromCents(Math.round(toCents(total) / qty));
}

export function assembleBatchCostBreakdown(options: {
  lines: CostLineResult[];
  outputQuantity: number;
  missingComponents?: string[];
}): BatchCostBreakdown {
  const lines = options.lines;
  const materialCost = sumComponent(lines, "raw_material");
  const packagingCost = sumComponent(lines, "packaging");
  const laborCost = sumComponent(lines, "labor");
  const machineCost = sumComponent(lines, "machine");
  const overheadCost = sumComponent(lines, "overhead");
  const qualityCost = sumComponent(lines, "quality");
  const reworkCost = sumComponent(lines, "rework");
  const wastageCost = sumComponent(lines, "wastage");
  const otherCost = sumComponent(lines, "other");
  const credits = sumComponent(lines, "credit");
  const totalBatchCost = money(
    materialCost +
      packagingCost +
      laborCost +
      machineCost +
      overheadCost +
      qualityCost +
      reworkCost +
      wastageCost +
      otherCost -
      credits
  );
  const outputQuantity = validateNonNegative("Output quantity", options.outputQuantity);
  const costPerUnit = outputQuantity > 0 ? calculateBatchUnitCost(totalBatchCost, outputQuantity) : 0;

  const qualities = new Set(lines.map((line) => line.dataQuality));
  let dataQuality: CostDataQuality = "actual";
  if (qualities.has("missing") || (options.missingComponents?.length ?? 0) > 0) dataQuality = "provisional";
  else if (qualities.has("provisional")) dataQuality = "provisional";
  else if (qualities.has("estimated")) dataQuality = "estimated";
  else if (qualities.has("standard") && !qualities.has("actual")) dataQuality = "standard";

  return {
    materialCost,
    packagingCost,
    laborCost,
    machineCost,
    overheadCost,
    qualityCost,
    reworkCost,
    wastageCost,
    otherCost,
    credits,
    totalBatchCost,
    outputQuantity,
    costPerUnit,
    dataQuality,
    missingComponents: options.missingComponents || [],
    lines,
  };
}

/** Standard product cost from BOM quantities × standard rates. */
export function calculateProductStandardCost(options: {
  materialLines: Array<{ quantity: unknown; unitCost: unknown; isPackaging?: boolean }>;
  laborHours?: unknown;
  laborRate?: unknown;
  machineHours?: unknown;
  machineRate?: unknown;
  overheadAmount?: unknown;
  qualityAmount?: unknown;
  standardBatchSize: unknown;
  standardYieldPercent?: unknown;
}) {
  const materialCost = options.materialLines
    .filter((line) => !line.isPackaging)
    .reduce((sum, line) => addMoney(sum, multiplyMoney(line.quantity, line.unitCost)), 0);
  const packagingCost = options.materialLines
    .filter((line) => line.isPackaging)
    .reduce((sum, line) => addMoney(sum, multiplyMoney(line.quantity, line.unitCost)), 0);
  const laborCost = multiplyMoney(options.laborHours, options.laborRate);
  const machineCost = multiplyMoney(options.machineHours, options.machineRate);
  const overhead = money(options.overheadAmount);
  const quality = money(options.qualityAmount);
  const totalBatchCost = addMoney(materialCost, packagingCost, laborCost, machineCost, overhead, quality);
  const batchSize = validateNonNegative("Standard batch size", options.standardBatchSize);
  const yieldPercent = money(options.standardYieldPercent ?? 100);
  const outputQuantity = multiplyMoney(batchSize, yieldPercent / 100);
  const costPerUnit = outputQuantity > 0 ? calculateBatchUnitCost(totalBatchCost, outputQuantity) : 0;
  return {
    materialCost,
    packagingCost,
    laborCost,
    machineCost,
    overheadCost: overhead,
    qualityCost: quality,
    totalBatchCost,
    standardBatchSize: batchSize,
    standardYieldPercent: yieldPercent,
    outputQuantity,
    costPerUnit,
  };
}

export function allocateManufacturingOverhead(options: {
  poolAmount: unknown;
  basisQuantity: unknown;
  totalBasisQuantity: unknown;
  alreadyAllocated?: unknown;
}) {
  const pool = validateNonNegative("Overhead pool", options.poolAmount);
  const basis = validateNonNegative("Basis quantity", options.basisQuantity);
  const totalBasis = validateNonNegative("Total basis quantity", options.totalBasisQuantity);
  if (totalBasis <= 0) fail("Total allocation basis must be greater than zero.");
  const allocated = fromCents(Math.round((toCents(pool) * toCents(basis)) / toCents(totalBasis)));
  const already = money(options.alreadyAllocated);
  if (addMoney(already, allocated) > addMoney(pool, 0.01)) {
    fail("Allocation would exceed the overhead cost pool.");
  }
  return {
    allocatedAmount: allocated,
    rate: fromCents(Math.round(toCents(pool) / toCents(totalBasis))),
    basisQuantity: basis,
  };
}

export function calculateYieldMetrics(options: {
  plannedQuantity: unknown;
  actualQuantity: unknown;
  standardYieldPercent?: unknown;
  standardWastagePercent?: unknown;
  actualWastageQuantity?: unknown;
}) {
  const planned = validateNonNegative("Planned quantity", options.plannedQuantity);
  const actual = validateNonNegative("Actual quantity", options.actualQuantity);
  const actualYieldPercent = planned > 0 ? money((actual / planned) * 100) : 0;
  const standardYield = money(options.standardYieldPercent ?? 100);
  const standardWastage = money(options.standardWastagePercent ?? 0);
  const expectedOutput = multiplyMoney(planned, standardYield / 100);
  const expectedWastage = multiplyMoney(planned, standardWastage / 100);
  const actualWastage = validateNonNegative("Actual wastage", options.actualWastageQuantity);
  return {
    plannedQuantity: planned,
    actualQuantity: actual,
    actualYieldPercent,
    standardYieldPercent: standardYield,
    yieldVarianceQuantity: subtractMoney(actual, expectedOutput),
    yieldVariancePercent: money(actualYieldPercent - standardYield),
    expectedWastage,
    actualWastage,
    wastageVarianceQuantity: subtractMoney(actualWastage, expectedWastage),
  };
}

/**
 * Material price variance = (actualPrice - standardPrice) × actualQty
 * Material usage variance = (actualQty - standardQty) × standardPrice
 * Positive = unfavorable under this convention.
 */
export function calculateCostVariances(options: {
  actualMaterialQty: unknown;
  actualMaterialPrice: unknown;
  standardMaterialQty: unknown;
  standardMaterialPrice: unknown;
  actualPackQty?: unknown;
  actualPackPrice?: unknown;
  standardPackQty?: unknown;
  standardPackPrice?: unknown;
  actualLaborHours?: unknown;
  actualLaborRate?: unknown;
  standardLaborHours?: unknown;
  standardLaborRate?: unknown;
  actualMachineHours?: unknown;
  actualMachineRate?: unknown;
  standardMachineHours?: unknown;
  standardMachineRate?: unknown;
  actualOverhead?: unknown;
  absorbedOverhead?: unknown;
  actualTotal?: unknown;
  standardTotal?: unknown;
  actualUnitCost?: unknown;
  standardUnitCost?: unknown;
  yieldVarianceCost?: unknown;
  wastageVarianceCost?: unknown;
  reworkCost?: unknown;
}) {
  const aQty = money(options.actualMaterialQty);
  const aPrice = money(options.actualMaterialPrice);
  const sQty = money(options.standardMaterialQty);
  const sPrice = money(options.standardMaterialPrice);
  const materialPrice = multiplyMoney(subtractMoney(aPrice, sPrice), aQty);
  const materialUsage = multiplyMoney(subtractMoney(aQty, sQty), sPrice);

  const apQty = money(options.actualPackQty);
  const apPrice = money(options.actualPackPrice);
  const spQty = money(options.standardPackQty);
  const spPrice = money(options.standardPackPrice);
  const packagingPrice = multiplyMoney(subtractMoney(apPrice, spPrice), apQty);
  const packagingUsage = multiplyMoney(subtractMoney(apQty, spQty), spPrice);

  const aHours = money(options.actualLaborHours);
  const aRate = money(options.actualLaborRate);
  const sHours = money(options.standardLaborHours);
  const sRate = money(options.standardLaborRate);
  const laborRate = multiplyMoney(subtractMoney(aRate, sRate), aHours);
  const laborEfficiency = multiplyMoney(subtractMoney(aHours, sHours), sRate);

  const amHours = money(options.actualMachineHours);
  const amRate = money(options.actualMachineRate);
  const smHours = money(options.standardMachineHours);
  const smRate = money(options.standardMachineRate);
  const machineRate = multiplyMoney(subtractMoney(amRate, smRate), amHours);
  const machineUsage = multiplyMoney(subtractMoney(amHours, smHours), smRate);

  const overheadSpending = subtractMoney(options.actualOverhead, options.absorbedOverhead);
  const overheadAbsorption = subtractMoney(options.absorbedOverhead, options.actualOverhead);
  const totalBatch = subtractMoney(options.actualTotal, options.standardTotal);
  const unitCost = subtractMoney(options.actualUnitCost, options.standardUnitCost);

  const rows: Array<{ type: VarianceType; amount: number }> = [
    { type: "material_price", amount: materialPrice },
    { type: "material_usage", amount: materialUsage },
    { type: "packaging_price", amount: packagingPrice },
    { type: "packaging_usage", amount: packagingUsage },
    { type: "labor_rate", amount: laborRate },
    { type: "labor_efficiency", amount: laborEfficiency },
    { type: "machine_rate", amount: machineRate },
    { type: "machine_usage", amount: machineUsage },
    { type: "overhead_spending", amount: overheadSpending },
    { type: "overhead_absorption", amount: overheadAbsorption },
    { type: "yield", amount: money(options.yieldVarianceCost) },
    { type: "wastage", amount: money(options.wastageVarianceCost) },
    { type: "rework", amount: money(options.reworkCost) },
    { type: "total_batch", amount: totalBatch },
    { type: "unit_cost", amount: unitCost },
  ];

  return {
    rows,
    totalFavorable: rows.filter((row) => row.amount < 0).reduce((sum, row) => addMoney(sum, Math.abs(row.amount)), 0),
    totalUnfavorable: rows.filter((row) => row.amount > 0).reduce((sum, row) => addMoney(sum, row.amount), 0),
  };
}

export function calculateProfitability(options: {
  netSales: unknown;
  discounts?: unknown;
  credits?: unknown;
  productCost: unknown;
  manufacturingCost?: unknown;
  allocatedCost?: unknown;
  freightCost?: unknown;
  otherCost?: unknown;
  marginQuality: CostDataQuality | "finalized";
}) {
  const netSales = money(options.netSales);
  const discounts = money(options.discounts);
  const credits = money(options.credits);
  const revenue = subtractMoney(netSales, addMoney(discounts, credits));
  const cost = addMoney(
    options.productCost,
    options.manufacturingCost,
    options.allocatedCost,
    options.freightCost,
    options.otherCost
  );
  const grossProfit = subtractMoney(revenue, cost);
  const grossMarginPercent = revenue > 0 ? money((grossProfit / revenue) * 100) : 0;
  return {
    netSales,
    discounts,
    credits,
    revenue,
    totalCost: cost,
    grossProfit,
    grossMarginPercent,
    marginQuality: options.marginQuality,
    isNetProfit: false,
  };
}

export function validateCostingCompleteness(options: {
  hasMaterial: boolean;
  hasOutput: boolean;
  hasLabor?: boolean;
  hasMachine?: boolean;
  hasOverhead?: boolean;
  requireLabor?: boolean;
  requireMachine?: boolean;
  requireOverhead?: boolean;
}) {
  const missing: string[] = [];
  if (!options.hasMaterial) missing.push("material_consumption");
  if (!options.hasOutput) missing.push("output_quantity");
  if (options.requireLabor && !options.hasLabor) missing.push("labor_hours");
  if (options.requireMachine && !options.hasMachine) missing.push("machine_hours");
  if (options.requireOverhead && !options.hasOverhead) missing.push("overhead_allocation");
  return {
    complete: missing.length === 0,
    missingComponents: missing,
    statusLabel: missing.length === 0 ? "complete" : "incomplete",
  };
}

export function detectDuplicateSourceLines(
  lines: Array<{ sourceCollection?: string; sourceId?: string; componentType?: string }>
) {
  const seen = new Set<string>();
  for (const line of lines) {
    const key = `${text(line.sourceCollection)}:${text(line.sourceId)}:${text(line.componentType)}`;
    if (!text(line.sourceId)) continue;
    if (seen.has(key)) fail(`Duplicate cost source detected: ${key}`);
    seen.add(key);
  }
}
