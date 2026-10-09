export const EQUIPMENT_CATEGORIES = [
  "manufacturing",
  "packaging",
  "laboratory_instrument",
  "hvac",
  "water_system",
  "compressed_air",
  "electrical",
  "boiler_steam",
  "refrigeration",
  "warehouse",
  "weighing",
  "monitoring_sensor",
  "other",
] as const;

export const EQUIPMENT_STATUSES = [
  "draft",
  "under_installation",
  "commissioning",
  "in_service",
  "maintenance_due",
  "under_maintenance",
  "calibration_due",
  "under_calibration",
  "qualification_pending",
  "restricted",
  "out_of_service",
  "decommissioned",
] as const;

export const CRITICALITY_LEVELS = ["critical", "major", "minor", "non_critical"] as const;

export const WORK_ORDER_TYPES = [
  "preventive",
  "corrective",
  "breakdown",
  "calibration_support",
  "improvement",
  "inspection",
] as const;

export const WORK_ORDER_STATUSES = [
  "draft",
  "submitted",
  "review",
  "approved",
  "assigned",
  "in_progress",
  "waiting_for_parts",
  "work_completed",
  "engineering_review",
  "qa_review",
  "closed",
  "rejected",
  "cancelled",
  "reopened",
] as const;

export const BREAKDOWN_SEVERITIES = ["critical", "high", "medium", "low"] as const;

export const BREAKDOWN_STATUSES = [
  "reported",
  "acknowledged",
  "under_repair",
  "awaiting_parts",
  "restored",
  "qa_assessment",
  "closed",
  "cancelled",
] as const;

export const CALIBRATION_STATUSES = [
  "scheduled",
  "requested",
  "approved",
  "in_progress",
  "results_review",
  "passed",
  "failed",
  "out_of_tolerance",
  "closed",
  "cancelled",
] as const;

export const INSTRUMENT_STATUSES = [
  "draft",
  "in_service",
  "calibration_due",
  "under_calibration",
  "restricted",
  "out_of_service",
  "retired",
] as const;

export const QUALIFICATION_TYPES = ["urs", "dq", "iq", "oq", "pq", "requalification"] as const;

export const QUALIFICATION_STATUSES = [
  "draft",
  "protocol_approved",
  "in_execution",
  "under_review",
  "approved",
  "effective",
  "rejected",
  "superseded",
] as const;

export const UTILITY_SYSTEM_TYPES = [
  "hvac",
  "ahu",
  "purified_water",
  "wfi",
  "compressed_air",
  "steam",
  "chilled_water",
  "boiler",
  "refrigeration",
  "electrical",
  "generator",
  "other",
] as const;

export const MONITORING_PARAMETERS = [
  "temperature",
  "humidity",
  "differential_pressure",
  "flow",
  "conductivity",
  "other",
] as const;

export const ENGINEERING_REPORT_TYPES = [
  "equipment_register",
  "pm_compliance",
  "work_order_register",
  "breakdown_register",
  "calibration_due",
  "calibration_register",
  "qualification_status",
  "spare_parts_shortage",
  "utility_alerts",
  "downtime_analysis",
  "maintenance_cost",
  "mttr_mtbf",
  "compliance_calendar",
] as const;

export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];
export type CalibrationStatus = (typeof CALIBRATION_STATUSES)[number];
export type EngineeringReportType = (typeof ENGINEERING_REPORT_TYPES)[number];
