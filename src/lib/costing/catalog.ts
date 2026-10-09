import {
  COSTING_METHODS,
  COSTING_REPORT_TYPES,
  COSTING_STATUSES,
  COST_COMPONENT_TYPES,
  OVERHEAD_ALLOCATION_BASES,
  VARIANCE_TYPES,
} from "@/types/costing";

function options(values: readonly string[], labels: Record<string, string> = {}) {
  return values.map((value) => ({
    value,
    label: labels[value] || value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
}

export const costingStatusOptions = options(COSTING_STATUSES);
export const costingMethodOptions = options(COSTING_METHODS);
export const costComponentOptions = options(COST_COMPONENT_TYPES);
export const varianceTypeOptions = options(VARIANCE_TYPES);
export const reportTypeOptions = options(COSTING_REPORT_TYPES);
export const allocationBasisOptions = options(OVERHEAD_ALLOCATION_BASES);

export function labelFor(optionsList: Array<{ label: string; value: string }>, value: string) {
  return optionsList.find((row) => row.value === value)?.label || value || "—";
}

export function workflowTone(status: string): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  if (["approved", "finalized", "reconciled", "active"].includes(status)) return "success";
  if (["validation", "department_review", "costing_review", "finance_review", "calculated"].includes(status)) {
    return "warning";
  }
  if (["rejected", "cancelled"].includes(status)) return "critical";
  if (["superseded"].includes(status)) return "hold";
  if (["provisional", "incomplete"].includes(status)) return "info";
  return "neutral";
}
