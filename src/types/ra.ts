export const PROFILE_STATUSES = [
  "not_assessed",
  "assessment_pending",
  "registration_required",
  "registration_in_progress",
  "registered",
  "suspended",
  "withdrawn",
  "expired",
] as const;

export const REGISTRATION_STATUSES = [
  "draft",
  "preparation",
  "submitted",
  "under_review",
  "query_received",
  "approved",
  "rejected",
  "suspended",
  "expired",
  "withdrawn",
] as const;

export const REGISTRATION_TYPES = [
  "new_registration",
  "renewal",
  "variation",
  "transfer",
  "amendment",
  "extension",
  "other",
] as const;

export const SUBMISSION_STATUSES = [
  "draft",
  "in_preparation",
  "internal_review",
  "approved_for_submission",
  "submitted",
  "acknowledged",
  "under_review",
  "query_received",
  "response_submitted",
  "approved",
  "rejected",
  "withdrawn",
  "closed",
] as const;

export const DOCUMENT_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "submitted",
  "superseded",
  "expired",
  "obsolete",
] as const;

export const DOCUMENT_TYPES = [
  "manufacturing_license",
  "product_license",
  "certificate",
  "gmp_certificate",
  "cpp",
  "coa",
  "specification",
  "stability_report",
  "validation_report",
  "regulatory_certificate",
  "authorization_letter",
  "free_sale_certificate",
  "customer_requirement",
  "label",
  "artwork",
  "submission_document",
  "authority_letter",
  "other",
] as const;

export const LICENSE_STATUSES = ["draft", "active", "expiring_soon", "expired", "suspended", "cancelled"] as const;

export const RENEWAL_STATUSES = [
  "not_started",
  "planning",
  "documents_pending",
  "ready",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "closed",
] as const;

export const QUERY_STATUSES = [
  "received",
  "assigned",
  "in_preparation",
  "internal_review",
  "approved",
  "submitted",
  "accepted",
  "closed",
  "overdue",
] as const;

export const COMMITMENT_STATUSES = ["open", "in_progress", "pending_evidence", "completed", "overdue", "cancelled"] as const;

export const COMMITMENT_SOURCES = [
  "authority_approval",
  "regulatory_submission",
  "regulatory_query",
  "inspection",
  "audit",
  "license",
  "registration",
  "other",
] as const;

export const COMMUNICATION_TYPES = [
  "submission",
  "query",
  "response",
  "notice",
  "approval",
  "rejection",
  "renewal",
  "other",
] as const;

export const COMMUNICATION_DIRECTIONS = ["incoming", "outgoing"] as const;

export const ARTWORK_STATUSES = ["draft", "ra_review", "customer_review", "approved", "rejected", "superseded"] as const;

export const CHANGE_STATUSES = [
  "new_requirement",
  "ra_assessment",
  "impact_assessment",
  "department_review",
  "action_plan",
  "implementation",
  "verification",
  "closed",
] as const;

export const EXPIRY_STATUSES = ["active", "expiring_soon", "critical", "expired"] as const;

export const RA_REPORT_TYPES = [
  "registration",
  "submission",
  "registration_expiry",
  "license_expiry",
  "renewal",
  "query",
  "commitment",
  "overdue_commitment",
  "communication",
  "product_market",
  "document",
  "artwork",
  "regulatory_change",
  "compliance_calendar",
  "customer_requirement",
] as const;

export const DOSSIER_SECTIONS = [
  "administrative",
  "product_information",
  "manufacturing",
  "quality",
  "qc",
  "qa",
  "stability",
  "packaging",
  "labeling",
  "safety",
  "regulatory",
  "supporting_documents",
] as const;

export type ExpiryStatus = (typeof EXPIRY_STATUSES)[number];

export interface RaSignature {
  signedBy: string;
  signedByEmail: string;
  signedByRole: string;
  signedAt: string;
  action: string;
  reason: string;
  signatureReference: string;
}

export interface ExpiryThresholds {
  soonDays: number;
  warningDays: number;
  criticalDays: number;
  urgentDays: number;
}
