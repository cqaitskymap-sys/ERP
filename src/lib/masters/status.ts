export const ALLOWED_MASTER_STATUSES = [
  "active",
  "inactive",
  "closed",
  "draft",
  "discontinued",
  "under_development",
  "blocked",
  "under_review",
  "approved",
  "obsolete",
  "expired",
  "submitted",
  "document_review",
  "qualification",
  "qa_review",
  "rejected",
  "suspended",
  "terminated",
  "superseded",
  "not_started",
  "under_review",
  "qualified",
  "conditionally_qualified",
] as const;

export function isAllowedMasterStatus(value: string) {
  return (ALLOWED_MASTER_STATUSES as readonly string[]).includes(value);
}
