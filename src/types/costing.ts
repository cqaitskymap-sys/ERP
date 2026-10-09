export const COSTING_METHODS = [
  "standard",
  "actual",
  "estimated",
  "provisional",
  "batch",
  "product",
] as const;

export const COSTING_STATUSES = [
  "draft",
  "calculated",
  "validation",
  "department_review",
  "costing_review",
  "finance_review",
  "approved",
  "finalized",
  "reconciled",
  "rejected",
  "superseded",
  "cancelled",
] as const;

export const COST_COMPONENT_TYPES = [
  "raw_material",
  "packaging",
  "labor",
  "machine",
  "overhead",
  "quality",
  "rework",
  "wastage",
  "other",
  "credit",
] as const;

export const COST_DATA_QUALITIES = [
  "actual",
  "standard",
  "estimated",
  "provisional",
  "missing",
] as const;

export const VARIANCE_TYPES = [
  "material_price",
  "material_usage",
  "packaging_price",
  "packaging_usage",
  "labor_rate",
  "labor_efficiency",
  "machine_rate",
  "machine_usage",
  "overhead_spending",
  "overhead_absorption",
  "yield",
  "wastage",
  "rework",
  "total_batch",
  "unit_cost",
] as const;

export const MARGIN_QUALITIES = [
  "standard",
  "estimated",
  "provisional",
  "actual",
  "finalized",
] as const;

export const COSTING_REPORT_TYPES = [
  "batch_cost_register",
  "standard_vs_actual",
  "variance_summary",
  "material_cost",
  "packaging_cost",
  "labor_cost",
  "machine_cost",
  "overhead_allocation",
  "yield_wastage",
  "rework_cost",
  "quality_cost",
  "cost_center",
  "product_profitability",
  "customer_profitability",
  "cmo_costing",
  "incomplete_records",
  "pending_approvals",
  "ledger_reconciliation",
] as const;

export const OVERHEAD_ALLOCATION_BASES = [
  "labor_hours",
  "standard_labor_hours",
  "machine_hours",
  "production_quantity",
  "batch_count",
  "direct_material_cost",
  "direct_labor_cost",
  "cost_center_driver",
] as const;

export type CostingMethod = (typeof COSTING_METHODS)[number];
export type CostingStatus = (typeof COSTING_STATUSES)[number];
export type CostComponentType = (typeof COST_COMPONENT_TYPES)[number];
export type CostDataQuality = (typeof COST_DATA_QUALITIES)[number];
export type VarianceType = (typeof VARIANCE_TYPES)[number];
export type MarginQuality = (typeof MARGIN_QUALITIES)[number];
export type CostingReportType = (typeof COSTING_REPORT_TYPES)[number];

export interface CostLineResult {
  componentType: CostComponentType;
  sourceCollection?: string;
  sourceId?: string;
  materialId?: string;
  description: string;
  quantity: number;
  uom: string;
  unitCost: number;
  totalCost: number;
  valuationBasis: string;
  dataQuality: CostDataQuality;
  currency: string;
}

export interface BatchCostBreakdown {
  materialCost: number;
  packagingCost: number;
  laborCost: number;
  machineCost: number;
  overheadCost: number;
  qualityCost: number;
  reworkCost: number;
  wastageCost: number;
  otherCost: number;
  credits: number;
  totalBatchCost: number;
  outputQuantity: number;
  costPerUnit: number;
  dataQuality: CostDataQuality;
  missingComponents: string[];
  lines: CostLineResult[];
}
