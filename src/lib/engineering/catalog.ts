import {
  BREAKDOWN_SEVERITIES,
  BREAKDOWN_STATUSES,
  CALIBRATION_STATUSES,
  CRITICALITY_LEVELS,
  ENGINEERING_REPORT_TYPES,
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_STATUSES,
  INSTRUMENT_STATUSES,
  MONITORING_PARAMETERS,
  QUALIFICATION_STATUSES,
  QUALIFICATION_TYPES,
  UTILITY_SYSTEM_TYPES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
} from "@/types/engineering";

function options(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
}

export const equipmentStatusOptions = options(EQUIPMENT_STATUSES);
export const equipmentCategoryOptions = options(EQUIPMENT_CATEGORIES);
export const criticalityOptions = options(CRITICALITY_LEVELS);
export const workOrderStatusOptions = options(WORK_ORDER_STATUSES);
export const workOrderTypeOptions = options(WORK_ORDER_TYPES);
export const breakdownSeverityOptions = options(BREAKDOWN_SEVERITIES);
export const breakdownStatusOptions = options(BREAKDOWN_STATUSES);
export const calibrationStatusOptions = options(CALIBRATION_STATUSES);
export const instrumentStatusOptions = options(INSTRUMENT_STATUSES);
export const qualificationTypeOptions = options(QUALIFICATION_TYPES);
export const qualificationStatusOptions = options(QUALIFICATION_STATUSES);
export const monitoringParameterOptions = options(MONITORING_PARAMETERS);
export const utilityTypeOptions = options(UTILITY_SYSTEM_TYPES);
export const reportTypeOptions = options(ENGINEERING_REPORT_TYPES);

export function labelFor(optionsList: Array<{ label: string; value: string }>, value: string) {
  return optionsList.find((row) => row.value === value)?.label || value || "—";
}

export function workflowTone(status: string): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  if (["in_service", "closed", "passed", "effective", "completed", "approved"].includes(status)) return "success";
  if (["scheduled", "submitted", "review", "results_review", "qa_review", "engineering_review"].includes(status)) {
    return "warning";
  }
  if (["failed", "out_of_tolerance", "out_of_service", "cancelled", "rejected"].includes(status)) return "critical";
  if (["restricted", "waiting_for_parts", "under_maintenance", "under_calibration"].includes(status)) return "hold";
  if (["in_progress", "assigned", "acknowledged"].includes(status)) return "info";
  return "neutral";
}
