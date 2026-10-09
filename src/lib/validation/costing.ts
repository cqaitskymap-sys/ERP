import { z } from "zod";
import {
  COSTING_METHODS,
  COSTING_STATUSES,
  COST_COMPONENT_TYPES,
  OVERHEAD_ALLOCATION_BASES,
  VARIANCE_TYPES,
} from "@/types/costing";

const optionalText = z.string().trim().optional().or(z.literal(""));
const moneyField = z.coerce.number().finite().min(0).default(0);
const qtyField = z.coerce.number().finite().min(0).default(0);

export const costingSettingsSchema = z.object({
  methodology: z.enum(COSTING_METHODS).default("actual"),
  methodologyVersion: z.string().trim().min(1).default("1.0"),
  currency: z.string().trim().min(1).default("INR"),
  materialValuationSource: z.enum(["purchase_order", "standard_rate", "manual"]).default("purchase_order"),
  laborRateSource: z.enum(["rate_card", "manual", "unavailable"]).default("rate_card"),
  machineRateSource: z.enum(["rate_card", "manual", "unavailable"]).default("rate_card"),
  overheadAllocationBasis: z.enum(OVERHEAD_ALLOCATION_BASES).default("direct_material_cost"),
  outputQuantityPolicy: z.enum(["produced", "released", "saleable"]).default("saleable"),
  varianceThresholdPercent: z.coerce.number().finite().min(0).default(5),
  yieldTolerancePercent: z.coerce.number().finite().min(0).default(2),
  allowEstimatedWhenMissing: z.boolean().default(false),
  requireLabor: z.boolean().default(false),
  requireMachine: z.boolean().default(false),
  requireOverhead: z.boolean().default(false),
  requireVarianceExplanation: z.boolean().default(true),
  approvalRequired: z.boolean().default(true),
});

export const productStandardSchema = z.object({
  productId: z.string().trim().min(1),
  bomId: z.string().trim().min(1),
  effectiveFrom: z.string().trim().min(1),
  effectiveTo: optionalText,
  standardBatchSize: qtyField,
  standardYieldPercent: z.coerce.number().finite().min(0).max(100).default(100),
  laborHours: qtyField,
  laborRate: moneyField,
  machineHours: qtyField,
  machineRate: moneyField,
  overheadAmount: moneyField,
  qualityAmount: moneyField,
  currency: z.string().trim().min(1).default("INR"),
  methodologyVersion: z.string().trim().min(1).default("1.0"),
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const rateCardSchema = z.object({
  name: z.string().trim().min(1),
  rateType: z.enum(["labor", "machine", "overhead", "quality", "material_standard"]),
  referenceId: optionalText,
  rate: moneyField,
  uom: z.string().trim().min(1).default("hour"),
  currency: z.string().trim().min(1).default("INR"),
  effectiveFrom: z.string().trim().min(1),
  effectiveTo: optionalText,
  status: z.enum(["draft", "active", "inactive"]).default("active"),
});

export const allocationRuleSchema = z.object({
  name: z.string().trim().min(1),
  costPoolAmount: moneyField,
  allocationBasis: z.enum(OVERHEAD_ALLOCATION_BASES),
  costCenterId: optionalText,
  effectiveFrom: z.string().trim().min(1),
  effectiveTo: optionalText,
  version: z.string().trim().min(1).default("1.0"),
  currency: z.string().trim().min(1).default("INR"),
  status: z.enum(["draft", "active", "inactive"]).default("active"),
});

export const batchCostingCreateSchema = z.object({
  manufacturingOrderId: z.string().trim().min(1),
  productStandardId: optionalText,
  costCenterId: optionalText,
  customerId: optionalText,
  siteId: optionalText,
  departmentId: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const batchCostingActionSchema = z.object({
  comment: optionalText,
  reason: optionalText,
  varianceExplanation: optionalText,
  toStatus: z.enum(COSTING_STATUSES).optional(),
});

export const varianceInvestigationSchema = z.object({
  batchCostingId: z.string().trim().min(1),
  varianceType: z.enum(VARIANCE_TYPES),
  amount: moneyField,
  explanation: z.string().trim().min(1),
  responsibleDepartmentId: optionalText,
  deviationId: optionalText,
});

export const manualCostLineSchema = z.object({
  componentType: z.enum(COST_COMPONENT_TYPES),
  description: z.string().trim().min(1),
  quantity: qtyField,
  unitCost: moneyField,
  uom: optionalText,
  materialId: optionalText,
  valuationBasis: optionalText,
  dataQuality: z.enum(["actual", "standard", "estimated", "provisional"]).default("estimated"),
});
