export const DEFAULT_VARIANCE_THRESHOLD_PERCENT = 5;
export const DEFAULT_YIELD_TOLERANCE_PERCENT = 2;
export const DEFAULT_CURRENCY = "INR";

export const COSTING_NUMBER_SERIES = {
  STD: { documentType: "CSTD", prefix: "CSTD" },
  BAT: { documentType: "CBAT", prefix: "CBAT" },
  VAR: { documentType: "CVAR", prefix: "CVAR" },
  INV: { documentType: "CINVST", prefix: "CINVST" },
  RATE: { documentType: "CRATE", prefix: "CRATE" },
  RULE: { documentType: "CRULE", prefix: "CRULE" },
} as const;

export const WORKFLOW_MODULES = {
  productStandard: "costing_product_standard",
  batchCosting: "costing_batch",
  varianceInvestigation: "costing_variance_investigation",
  allocationRule: "costing_allocation_rule",
} as const;
