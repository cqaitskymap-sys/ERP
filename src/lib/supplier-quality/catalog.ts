import {
  AGREEMENT_TYPES,
  AUDIT_STATUSES,
  AUDIT_TYPES,
  CHANGE_STATUSES,
  CHANGE_TYPES,
  DOCUMENT_STATUSES,
  FINDING_SEVERITIES,
  MATERIAL_QUAL_STATUSES,
  QUALIFICATION_STATUSES,
  QUALIFICATION_TYPES,
  QUESTIONNAIRE_STATUSES,
  REQUAL_STATUSES,
  SQ_PROFILE_STATUSES,
  SQ_REPORT_TYPES,
  SQ_RISK_LEVELS,
  SUSPENSION_REASONS,
  SUSPENSION_STATUSES,
} from "@/types/supplier-quality";
import { DEFAULT_DOCUMENT_TYPES } from "@/lib/supplier-quality/config";

function options(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
  }));
}

export function labelFor(list: Array<{ label: string; value: string }>, value: unknown) {
  return list.find((item) => item.value === value)?.label || String(value || "—");
}

export const profileStatusOptions = options(SQ_PROFILE_STATUSES);
export const riskLevelOptions = options(SQ_RISK_LEVELS);
export const qualificationTypeOptions = options(QUALIFICATION_TYPES);
export const qualificationStatusOptions = options(QUALIFICATION_STATUSES);
export const documentStatusOptions = options(DOCUMENT_STATUSES);
export const documentTypeOptions = options(DEFAULT_DOCUMENT_TYPES);
export const questionnaireStatusOptions = options(QUESTIONNAIRE_STATUSES);
export const materialQualStatusOptions = options(MATERIAL_QUAL_STATUSES);
export const auditTypeOptions = options(AUDIT_TYPES);
export const auditStatusOptions = options(AUDIT_STATUSES);
export const findingSeverityOptions = options(FINDING_SEVERITIES);
export const agreementTypeOptions = options(AGREEMENT_TYPES);
export const changeTypeOptions = options(CHANGE_TYPES);
export const changeStatusOptions = options(CHANGE_STATUSES);
export const suspensionReasonOptions = options(SUSPENSION_REASONS);
export const suspensionStatusOptions = options(SUSPENSION_STATUSES);
export const requalStatusOptions = options(REQUAL_STATUSES);
export const reportTypeOptions = options(SQ_REPORT_TYPES);

export function workflowTone(status: unknown): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  switch (String(status || "")) {
    case "approved":
    case "qualified":
    case "closed":
    case "valid":
    case "reactivated":
      return "success";
    case "critical":
    case "disqualified":
    case "expired":
    case "overdue":
    case "rejected":
      return "critical";
    case "suspended":
    case "high":
    case "conditional":
    case "conditional_approval":
      return "hold";
    case "qa_review":
    case "under_audit":
    case "expiring_soon":
      return "warning";
    case "draft":
    case "planned":
    case "not_assessed":
    case "screening":
      return "info";
    default:
      return "neutral";
  }
}
