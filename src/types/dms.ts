export const DOCUMENT_TYPES = [
  "sop",
  "work_instruction",
  "policy",
  "procedure",
  "form",
  "template",
  "register",
  "checklist",
  "specification",
  "analytical_method",
  "validation_protocol",
  "validation_report",
  "qualification",
  "bmr",
  "bpr",
  "quality_agreement",
  "technical_agreement",
  "training",
  "vendor",
  "regulatory_external",
  "engineering",
  "maintenance",
  "calibration",
  "equipment",
  "other",
] as const;

export const DOCUMENT_STATUSES = [
  "draft",
  "in_review",
  "changes_requested",
  "rejected",
  "approved",
  "effective",
  "superseded",
  "withdrawn",
  "cancelled",
  "archived",
] as const;

export const VERSION_STATUSES = DOCUMENT_STATUSES;

export const CLASSIFICATIONS = ["internal", "confidential", "restricted"] as const;

export const DCR_TYPES = ["new_document", "revision", "correction", "retirement", "withdrawal"] as const;

export const DCR_STATUSES = [
  "draft",
  "submitted",
  "in_review",
  "approved",
  "rejected",
  "in_implementation",
  "closed",
  "cancelled",
] as const;

export const PERIODIC_DECISIONS = ["no_change", "revision_required", "retirement_proposed"] as const;

export const PERIODIC_STATUSES = ["open", "completed", "cancelled"] as const;

export const EXTERNAL_STATUSES = ["active", "expiring", "expired", "archived"] as const;

export const REPORT_TYPES = [
  "registry",
  "reviews_due",
  "pending_approvals",
  "expiring_external",
  "change_requests",
  "training_impact",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export type Classification = (typeof CLASSIFICATIONS)[number];

export interface DmsSignature {
  signedBy: string;
  signedByEmail: string;
  signedByRole: string;
  signedAt: string;
  meaning: string;
  reason: string;
  documentNumber: string;
  versionLabel: string;
  stage: string;
  signatureReference: string;
}
