export const QA_REVIEW_STATUSES = [
  "pending_review",
  "under_review",
  "review_complete",
  "decision_pending",
  "released",
  "held",
  "rejected",
  "closed",
] as const;

export const QA_DECISIONS = ["release", "hold", "reject", "conditional"] as const;

export const CHECKLIST_STATUSES = ["pending", "satisfactory", "unsatisfactory", "not_applicable"] as const;

export const QA_PRIORITIES = ["normal", "urgent", "overdue", "critical"] as const;

export const HOLD_REASONS = [
  "investigation_pending",
  "documentation_issue",
  "oos",
  "deviation",
  "customer_clarification",
  "regulatory_concern",
  "other",
] as const;

export const REJECTION_CATEGORIES = [
  "quality_failure",
  "documentation",
  "process",
  "contamination",
  "customer_requirement",
  "other",
] as const;

export const DEVIATION_SOURCES = [
  "manufacturing",
  "qc",
  "warehouse",
  "documentation",
  "equipment",
  "material",
  "packaging",
  "environmental",
  "supplier",
  "other",
] as const;

export const QA_DEVIATION_STATUSES = [
  "open",
  "investigation",
  "qa_review",
  "capa_required",
  "action_pending",
  "effectiveness_review",
  "closed",
] as const;

export const QA_SEVERITIES = ["minor", "major", "critical"] as const;

export const CAPA_SOURCES = [
  "deviation",
  "oos",
  "oot",
  "audit",
  "complaint",
  "supplier_issue",
  "trend",
  "pv_case",
  "pv_signal",
  "other",
] as const;

export const CAPA_STATUSES = [
  "draft",
  "open",
  "action_in_progress",
  "effectiveness_review",
  "closed",
  "overdue",
] as const;

export const CHANGE_TYPES = ["major", "minor", "emergency"] as const;

export const CHANGE_STATUSES = [
  "draft",
  "submitted",
  "impact_assessment",
  "qa_review",
  "approved",
  "implementation",
  "verification",
  "closed",
  "rejected",
] as const;

export const QA_DOCUMENT_TYPES = [
  "sop",
  "specification",
  "bmr",
  "bpr",
  "test_method",
  "validation",
  "quality_agreement",
  "customer_specification",
  "coa",
  "training",
  "other",
] as const;

export const QA_DOCUMENT_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "effective",
  "superseded",
  "obsolete",
] as const;

export const QA_REPORT_TYPES = [
  "batch_release",
  "batch_hold",
  "batch_rejection",
  "qa_review",
  "deviation",
  "capa",
  "change_control",
  "oos_review",
  "oot_review",
  "turnaround",
  "compliance",
  "customer_release",
  "product_disposition",
  "expiring_document",
] as const;

export interface ReleaseValidation {
  eligible: boolean;
  blockers: string[];
  warnings: string[];
}

export interface QaSignature {
  signedBy: string;
  signedByEmail: string;
  signedByRole: string;
  signedAt: string;
  action: string;
  reason: string;
  signatureReference: string;
}
