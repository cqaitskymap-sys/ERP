export const PRODUCTION_PRIORITIES = ["low", "normal", "high", "urgent", "critical"] as const;

export const PLAN_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const SCHEDULE_STATUSES = [
  "planned",
  "scheduled",
  "ready",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
] as const;

export const BATCH_PLAN_STATUSES = ["draft", "planned", "approved", "scheduled", "cancelled"] as const;

export const MO_STATUSES = [
  "draft",
  "planned",
  "approved",
  "ready",
  "dispensing_pending",
  "manufacturing",
  "in_process",
  "completed",
  "qc_pending",
  "qa_pending",
  "held",
  "rejected",
  "released",
  "closed",
  "cancelled",
] as const;

export const BOM_STATUSES = ["draft", "under_review", "approved", "effective", "superseded", "obsolete"] as const;

export const MATERIAL_STAGES = [
  "raw_material",
  "api",
  "excipient",
  "packaging",
  "processing_aid",
  "other",
] as const;

export const DISPENSING_STATUSES = [
  "draft",
  "requested",
  "approved",
  "ready_for_dispensing",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const WORK_CENTER_TYPES = [
  "granulation",
  "compression",
  "coating",
  "filling",
  "packing",
  "liquid_manufacturing",
  "ointment",
  "inspection",
  "other",
] as const;

export const BMR_STATUSES = ["draft", "issued", "in_progress", "paused", "completed", "reviewed", "closed"] as const;

export const STEP_STATUSES = ["pending", "ready", "in_progress", "completed", "skipped", "failed"] as const;

export const IPC_RESULTS = ["pass", "fail", "pending"] as const;

export const YIELD_RESULTS = ["within_limit", "below_limit", "above_limit"] as const;

export const RECON_STATUSES = ["pending_review", "reconciled", "variance"] as const;

export const WASTAGE_REASONS = [
  "process_loss",
  "spillage",
  "rejection",
  "sampling",
  "equipment_loss",
  "other",
] as const;

export const DEVIATION_SEVERITIES = ["minor", "major", "critical"] as const;

export const DEVIATION_STATUSES = ["open", "under_investigation", "action_required", "closed"] as const;

export const ROUNDING_RULES = ["ceil", "floor", "nearest"] as const;

export const PRODUCTION_REPORT_TYPES = [
  "production_plan",
  "production_schedule",
  "batch",
  "manufacturing_order",
  "batch_status",
  "production_by_customer",
  "production_by_product",
  "material_requirement",
  "material_shortage",
  "batch_yield",
  "production_loss",
  "material_reconciliation",
  "work_center_utilization",
  "production_delay",
  "batch_traceability",
] as const;

export const DEFAULT_PROCESS_STEPS = [
  "Dispensing",
  "Sifting",
  "Granulation",
  "Drying",
  "Milling",
  "Blending",
  "Compression",
  "Coating",
  "Inspection",
  "Packing",
] as const;

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  warnings: string[];
}

export interface ReadinessResult {
  ready: boolean;
  blockers: string[];
  warnings: string[];
}

export interface MaterialRequirementLine {
  materialId: string;
  uom: string;
  quantityPerBatch: number;
  wastageAllowance: number;
  requiredQuantity: number;
  materialStage?: string;
  sequence?: number;
}

export interface MaterialAvailabilityLine extends MaterialRequirementLine {
  availableQuantity: number;
  approvedQuantity: number;
  quarantineQuantity: number;
  blockedQuantity: number;
  rejectedQuantity: number;
  shortage: number;
  status: "ok" | "short";
  suggestedAction: string;
}
