export const INTAKE_SOURCES = [
  "customer",
  "healthcare_professional",
  "patient",
  "distributor",
  "regulatory_authority",
  "sales_commercial",
  "employee",
  "literature",
  "website",
  "email",
  "phone",
  "other",
] as const;

export const INTAKE_STATUSES = [
  "received",
  "triage_pending",
  "converted_to_case",
  "duplicate",
  "invalid",
  "closed",
] as const;

export const INTAKE_URGENCIES = ["critical", "high", "medium", "low"] as const;

export const CASE_STATUSES = [
  "new",
  "triage",
  "processing",
  "medical_review",
  "follow_up_required",
  "regulatory_review",
  "reporting",
  "follow_up_pending",
  "closed",
  "reopened",
] as const;

export const CASE_PRIORITIES = ["critical", "high", "medium", "low"] as const;

export const REPORTER_TYPES = [
  "physician",
  "pharmacist",
  "nurse",
  "patient",
  "consumer",
  "distributor",
  "regulatory_authority",
  "other",
] as const;

export const PRODUCT_ROLES = ["suspect", "interacting", "concomitant"] as const;

export const EVENT_OUTCOMES = [
  "recovered",
  "recovering",
  "not_recovered",
  "recovered_with_sequelae",
  "fatal",
  "unknown",
] as const;

export const SEVERITIES = ["mild", "moderate", "severe", "unknown"] as const;

export const SERIOUSNESS_CRITERIA = [
  "death",
  "life_threatening",
  "hospitalization",
  "prolonged_hospitalization",
  "disability",
  "congenital_anomaly",
  "other_medically_important",
] as const;

export const EXPECTEDNESS_VALUES = ["expected", "unexpected", "unknown", "requires_review"] as const;

export const CAUSALITY_RESULTS = [
  "related",
  "possibly_related",
  "unlikely_related",
  "not_related",
  "unassessable",
] as const;

export const FOLLOWUP_STATUSES = [
  "requested",
  "pending",
  "received",
  "under_review",
  "closed",
  "overdue",
  "cancelled",
] as const;

export const REPORT_STATUSES = [
  "assessment_pending",
  "required",
  "not_required",
  "preparing",
  "internal_review",
  "approved",
  "submitted",
  "acknowledged",
  "rejected",
  "closed",
] as const;

export const SIGNAL_STATUSES = [
  "detected",
  "screening",
  "assessment",
  "confirmed",
  "monitoring",
  "closed",
] as const;

export const COMMITMENT_STATUSES = [
  "open",
  "in_progress",
  "pending_evidence",
  "completed",
  "overdue",
  "cancelled",
] as const;

export const MINIMUM_INFO_STATUSES = ["complete", "incomplete", "requires_review"] as const;

export const PV_REPORT_TYPES = [
  "safety_case",
  "serious_case",
  "intake",
  "product_safety",
  "batch_safety",
  "followup",
  "overdue_followup",
  "regulatory_reporting",
  "signal",
  "commitment",
  "case_tat",
  "customer_safety",
  "market_safety",
  "event_trend",
] as const;

export type PvSignature = {
  signedBy: string;
  signedByEmail: string;
  signedByRole: string;
  signedAt: string;
  action: string;
  reason: string;
  signatureReference: string;
};

export type MinimumInfoStatus = (typeof MINIMUM_INFO_STATUSES)[number];

export interface MinimumInformationResult {
  identifiablePatient: boolean;
  identifiableReporter: boolean;
  suspectProduct: boolean;
  adverseEvent: boolean;
  status: MinimumInfoStatus;
}

export interface DueDateCalculation {
  ruleId: string;
  ruleVersion: string;
  calculatedAt: string;
  dueDate: string;
  timezone: string;
}
