import {
  CLASSIFICATIONS,
  DCR_STATUSES,
  DCR_TYPES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  EXTERNAL_STATUSES,
  PERIODIC_DECISIONS,
  REPORT_TYPES,
} from "@/types/dms";

function options(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
  }));
}

export const documentTypeOptions = options(DOCUMENT_TYPES);
export const documentStatusOptions = options(DOCUMENT_STATUSES);
export const classificationOptions = options(CLASSIFICATIONS);
export const dcrTypeOptions = options(DCR_TYPES);
export const dcrStatusOptions = options(DCR_STATUSES);
export const periodicDecisionOptions = options(PERIODIC_DECISIONS);
export const externalStatusOptions = options(EXTERNAL_STATUSES);
export const reportTypeOptions = options(REPORT_TYPES);
export const revisionKindOptions = options(["minor", "major"] as const);

export function labelFor(optionsList: Array<{ label: string; value: string }>, value: string) {
  return optionsList.find((item) => item.value === value)?.label || value || "—";
}

export function workflowTone(status: string): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  if (["effective", "approved", "closed", "active", "completed"].includes(status)) return "success";
  if (["rejected", "withdrawn", "cancelled", "expired", "overdue"].includes(status)) return "critical";
  if (["in_review", "changes_requested", "expiring", "in_implementation", "submitted"].includes(status)) return "warning";
  if (["superseded", "archived"].includes(status)) return "hold";
  return "info";
}
