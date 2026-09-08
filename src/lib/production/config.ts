export const PRODUCTION_NUMBER_SERIES = {
  PLN: { documentType: "PLN", prefix: "PLN" },
  SCH: { documentType: "SCH", prefix: "SCH" },
  BPL: { documentType: "BPL", prefix: "BPL" },
  MO: { documentType: "MO", prefix: "MO" },
  BOM: { documentType: "BOM", prefix: "BOM" },
  DSP: { documentType: "DSP", prefix: "DSP" },
  BMR: { documentType: "BMR", prefix: "BMR" },
  IPC: { documentType: "IPC", prefix: "IPC" },
  YLD: { documentType: "YLD", prefix: "YLD" },
  REC: { documentType: "REC", prefix: "REC" },
  WST: { documentType: "WST", prefix: "WST" },
  DEV: { documentType: "DEV", prefix: "DEV" },
  WC: { documentType: "WC", prefix: "WC" },
  EQ: { documentType: "EQ", prefix: "EQ" },
} as const;

export const WORKFLOW_MODULES = {
  productionPlan: "production_plan",
  bom: "bom",
  manufacturingOrder: "manufacturing_order",
  dispensingRequest: "dispensing_request",
  yield: "yield",
  reconciliation: "reconciliation",
  wastage: "wastage",
} as const;

/** Default batch number pattern. Override via productionBatchNumbering config. */
export const DEFAULT_BATCH_NUMBER_PATTERN = "{productCode}-{yyMMdd}{seq}";

export const DEFAULT_YIELD_MIN = 95;
export const DEFAULT_YIELD_MAX = 105;
export const DEFAULT_ROUNDING_RULE = "ceil" as const;
export const DEFAULT_COUNT_QUARANTINE_AS_AVAILABLE = false;
