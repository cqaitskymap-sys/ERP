export const COMPLAINT_SOURCES = [
  "customer",
  "distributor",
  "wholesaler",
  "healthcare_professional",
  "patient_consumer",
  "regulatory_authority",
  "sales_team",
  "internal_employee",
  "market_surveillance",
  "other",
] as const;

export const COMPLAINT_STATUSES = [
  "received",
  "triage",
  "investigation_pending",
  "under_investigation",
  "qa_review",
  "capa_pending",
  "recall_assessment",
  "customer_response_pending",
  "closure_review",
  "closed",
  "reopened",
  "cancelled",
] as const;

export const COMPLAINT_SEVERITIES = ["critical", "major", "minor", "informational"] as const;

export const COMPLAINT_URGENCIES = ["critical", "high", "medium", "low"] as const;

export const DEFAULT_COMPLAINT_CATEGORIES = [
  "product_quality",
  "packaging_defect",
  "labeling_issue",
  "physical_defect",
  "appearance",
  "identity",
  "potency",
  "dissolution",
  "stability",
  "contamination",
  "microbiological",
  "foreign_matter",
  "leakage",
  "broken_container",
  "wrong_product",
  "wrong_label",
  "missing_information",
  "counterfeit_concern",
  "adverse_product_quality",
  "other",
] as const;

export const INVESTIGATION_STATUSES = [
  "not_started",
  "initiated",
  "in_progress",
  "pending_evidence",
  "qa_review",
  "completed",
  "closed",
] as const;

export const TASK_STATUSES = [
  "assigned",
  "in_progress",
  "pending_evidence",
  "completed",
  "overdue",
  "cancelled",
] as const;

export const SAMPLE_STATUSES = [
  "expected",
  "received",
  "logged",
  "under_testing",
  "testing_complete",
  "retained",
  "disposed",
] as const;

export const QA_DECISIONS = [
  "substantiated",
  "unsubstantiated",
  "inconclusive",
  "product_defect_confirmed",
  "no_product_defect",
  "further_investigation",
] as const;

export const COMMUNICATION_TYPES = [
  "acknowledgement",
  "investigation_update",
  "final_response",
  "clarification",
  "additional_information",
  "other",
] as const;

export const COMMUNICATION_STATUSES = ["draft", "review", "approved", "sent", "acknowledged"] as const;

export const RECALL_STATUSES = [
  "potential",
  "assessment",
  "qa_review",
  "management_approval",
  "regulatory_review",
  "initiated",
  "notification",
  "retrieval",
  "reconciliation",
  "effectiveness_check",
  "closed",
] as const;

export const RECALL_CLASSES = ["class_i", "class_ii", "class_iii", "other"] as const;

export const WITHDRAWAL_STATUSES = [
  "proposed",
  "assessment",
  "qa_review",
  "approved",
  "customer_notification",
  "recovery",
  "reconciliation",
  "closed",
] as const;

export const NOTIFICATION_STATUSES = [
  "assessment_pending",
  "required",
  "not_required",
  "preparing",
  "approved",
  "submitted",
  "acknowledged",
  "closed",
] as const;

export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export const COMPLAINT_REPORT_TYPES = [
  "register",
  "trend",
  "product",
  "batch",
  "customer",
  "market",
  "severity",
  "root_cause",
  "investigation_tat",
  "overdue",
  "capa_linked",
  "recall",
  "recall_reconciliation",
  "withdrawal",
  "regulatory_notification",
  "closure",
  "repeated",
  "effectiveness",
] as const;

export type ComplaintSignature = {
  signedBy: string;
  signedByEmail: string;
  signedByRole: string;
  signedAt: string;
  action: string;
  reason: string;
  signatureReference: string;
};
