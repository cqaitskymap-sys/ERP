export const SQ_PROFILE_STATUSES = [
  "not_assessed",
  "screening",
  "qualification_pending",
  "under_evaluation",
  "audit_required",
  "under_audit",
  "qa_review",
  "approved",
  "conditional_approval",
  "suspended",
  "disqualified",
  "expired",
] as const;

export const SQ_RISK_LEVELS = ["critical", "high", "medium", "low"] as const;

export const QUALIFICATION_TYPES = [
  "initial",
  "requalification",
  "conditional",
  "emergency",
  "material_specific",
] as const;

export const QUALIFICATION_STATUSES = [
  "draft",
  "screening",
  "document_collection",
  "questionnaire",
  "evaluation",
  "audit_required",
  "under_audit",
  "qa_review",
  "approved",
  "conditional",
  "rejected",
  "expired",
] as const;

export const DOCUMENT_STATUSES = [
  "valid",
  "expiring_soon",
  "expired",
  "under_review",
  "superseded",
  "rejected",
] as const;

export const QUESTIONNAIRE_STATUSES = [
  "draft",
  "sent",
  "supplier_response",
  "internal_review",
  "clarification",
  "final_review",
  "approved",
  "rejected",
] as const;

export const MATERIAL_QUAL_STATUSES = [
  "pending",
  "qualified",
  "conditional",
  "suspended",
  "disqualified",
  "expired",
] as const;

export const AUDIT_TYPES = [
  "initial_qualification",
  "periodic",
  "for_cause",
  "follow_up",
  "remote",
  "regulatory",
  "customer",
  "other",
] as const;

export const AUDIT_STATUSES = [
  "planned",
  "approved",
  "scheduled",
  "in_progress",
  "findings_recorded",
  "supplier_response",
  "qa_review",
  "capa_pending",
  "follow_up",
  "closed",
] as const;

export const FINDING_SEVERITIES = [
  "critical",
  "major",
  "minor",
  "observation",
  "opportunity",
] as const;

export const AGREEMENT_TYPES = [
  "quality",
  "technical",
  "supply",
  "confidentiality",
  "other",
] as const;

export const CHANGE_TYPES = [
  "manufacturing_site",
  "process",
  "raw_material",
  "equipment",
  "test_method",
  "specification",
  "packaging",
  "facility",
  "ownership",
  "regulatory",
  "key_personnel",
  "other",
] as const;

export const CHANGE_STATUSES = [
  "received",
  "qa_review",
  "impact_assessment",
  "approval",
  "implementation",
  "verification",
  "closed",
] as const;

export const SUSPENSION_REASONS = [
  "critical_quality_issue",
  "expired_qualification",
  "failed_audit",
  "regulatory_issue",
  "repeated_rejection",
  "capa_failure",
  "certificate_expiry",
  "management_decision",
  "other",
] as const;

export const SUSPENSION_STATUSES = [
  "proposed",
  "qa_review",
  "approved",
  "suspended",
  "reactivated",
  "disqualified",
] as const;

export const REQUAL_STATUSES = [
  "not_started",
  "planning",
  "document_review",
  "evaluation",
  "audit",
  "qa_review",
  "approved",
  "rejected",
  "overdue",
] as const;

export const SQ_REPORT_TYPES = [
  "approved_list",
  "qualification",
  "risk",
  "evaluation",
  "scorecard",
  "audit",
  "finding",
  "capa",
  "deviation",
  "certificate_expiry",
  "agreement_expiry",
  "requalification",
  "performance",
  "material_performance",
  "suspension",
  "disqualification",
  "change",
  "calendar",
  "trend",
] as const;

export type SupplierQualitySignature = {
  signedBy: string;
  signedByEmail: string;
  signedByRole: string;
  signedAt: string;
  action: string;
  reason: string;
  signatureReference: string;
};
