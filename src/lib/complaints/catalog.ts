import {
  COMMUNICATION_STATUSES,
  COMMUNICATION_TYPES,
  COMPLAINT_REPORT_TYPES,
  COMPLAINT_SEVERITIES,
  COMPLAINT_SOURCES,
  COMPLAINT_STATUSES,
  COMPLAINT_URGENCIES,
  INVESTIGATION_STATUSES,
  NOTIFICATION_STATUSES,
  QA_DECISIONS,
  RECALL_CLASSES,
  RECALL_STATUSES,
  RISK_LEVELS,
  SAMPLE_STATUSES,
  TASK_STATUSES,
  WITHDRAWAL_STATUSES,
} from "@/types/complaints";
import { DEFAULT_CATEGORY_OPTIONS, INVESTIGATION_DEPARTMENTS } from "@/lib/complaints/config";

function options(values: readonly string[], labels: Record<string, string> = {}) {
  return values.map((value) => ({
    value,
    label: labels[value] || value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
  }));
}

export function labelFor(list: Array<{ label: string; value: string }>, value: unknown) {
  return list.find((item) => item.value === value)?.label || String(value || "—");
}

export const sourceOptions = options(COMPLAINT_SOURCES);
export const statusOptions = options(COMPLAINT_STATUSES);
export const severityOptions = options(COMPLAINT_SEVERITIES);
export const urgencyOptions = options(COMPLAINT_URGENCIES);
export const defaultCategoryOptions = DEFAULT_CATEGORY_OPTIONS;
export const investigationStatusOptions = options(INVESTIGATION_STATUSES);
export const taskStatusOptions = options(TASK_STATUSES);
export const sampleStatusOptions = options(SAMPLE_STATUSES);
export const qaDecisionOptions = options(QA_DECISIONS);
export const communicationTypeOptions = options(COMMUNICATION_TYPES);
export const communicationStatusOptions = options(COMMUNICATION_STATUSES);
export const recallStatusOptions = options(RECALL_STATUSES);
export const recallClassOptions = options(RECALL_CLASSES, {
  class_i: "Class I",
  class_ii: "Class II",
  class_iii: "Class III",
  other: "Other",
});
export const withdrawalStatusOptions = options(WITHDRAWAL_STATUSES);
export const notificationStatusOptions = options(NOTIFICATION_STATUSES);
export const riskLevelOptions = options(RISK_LEVELS);
export const departmentOptions = options(INVESTIGATION_DEPARTMENTS);
export const reportTypeOptions = options(COMPLAINT_REPORT_TYPES);
export const rootCauseMethodOptions = options([
  "5_why",
  "fishbone",
  "process_analysis",
  "material_analysis",
  "equipment_analysis",
  "human_factor",
  "documentation_analysis",
  "environmental_analysis",
  "other",
]);
export function workflowTone(status: unknown): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  switch (String(status || "")) {
    case "closed":
    case "completed":
    case "acknowledged":
    case "approved":
    case "reconciled":
      return "success";
    case "critical":
    case "overdue":
    case "cancelled":
    case "disposed":
      return "critical";
    case "high":
    case "major":
    case "recall_assessment":
    case "initiated":
    case "required":
      return "hold";
    case "received":
    case "triage":
    case "draft":
    case "potential":
      return "info";
    case "qa_review":
    case "under_investigation":
    case "capa_pending":
    case "customer_response_pending":
      return "warning";
    default:
      return "neutral";
  }
}

export const riskFormulaOptions = [
  { value: "severity * occurrence * detectability", label: "Severity × Occurrence × Detectability" },
  { value: "severity * occurrence", label: "Severity × Occurrence" },
  { value: "severity + occurrence + detectability", label: "Severity + Occurrence + Detectability" },
];
