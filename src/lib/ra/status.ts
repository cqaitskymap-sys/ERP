export const PROFILE_TRANSITIONS: Record<string, string[]> = {
  not_assessed: ["assessment_pending", "registration_required"],
  assessment_pending: ["registration_required", "not_assessed"],
  registration_required: ["registration_in_progress"],
  registration_in_progress: ["registered", "suspended", "withdrawn"],
  registered: ["suspended", "withdrawn", "expired"],
  suspended: ["registered", "withdrawn"],
  withdrawn: [],
  expired: ["registration_required"],
};

export const REGISTRATION_TRANSITIONS: Record<string, string[]> = {
  draft: ["preparation"],
  preparation: ["submitted"],
  submitted: ["under_review", "withdrawn"],
  under_review: ["query_received", "approved", "rejected"],
  query_received: ["under_review", "approved", "rejected"],
  approved: ["suspended", "expired", "withdrawn"],
  rejected: ["preparation"],
  suspended: ["approved", "withdrawn"],
  expired: ["preparation"],
  withdrawn: [],
};

export const SUBMISSION_TRANSITIONS: Record<string, string[]> = {
  draft: ["in_preparation"],
  in_preparation: ["internal_review"],
  internal_review: ["approved_for_submission", "in_preparation"],
  approved_for_submission: ["submitted"],
  submitted: ["acknowledged", "withdrawn"],
  acknowledged: ["under_review"],
  under_review: ["query_received", "approved", "rejected"],
  query_received: ["response_submitted"],
  response_submitted: ["under_review", "approved", "rejected"],
  approved: ["closed"],
  rejected: ["closed", "in_preparation"],
  withdrawn: ["closed"],
  closed: [],
};

export const DOCUMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ["under_review", "obsolete"],
  under_review: ["approved", "draft"],
  approved: ["submitted", "superseded", "expired"],
  submitted: ["superseded"],
  superseded: [],
  expired: ["obsolete"],
  obsolete: [],
};

export const LICENSE_TRANSITIONS: Record<string, string[]> = {
  draft: ["active"],
  active: ["expiring_soon", "expired", "suspended", "cancelled"],
  expiring_soon: ["active", "expired", "cancelled"],
  expired: ["active", "cancelled"],
  suspended: ["active", "cancelled"],
  cancelled: [],
};

export const RENEWAL_TRANSITIONS: Record<string, string[]> = {
  not_started: ["planning"],
  planning: ["documents_pending", "ready"],
  documents_pending: ["ready"],
  ready: ["submitted"],
  submitted: ["under_review"],
  under_review: ["approved", "rejected"],
  approved: ["closed"],
  rejected: ["planning", "closed"],
  closed: [],
};

export const QUERY_TRANSITIONS: Record<string, string[]> = {
  received: ["assigned"],
  assigned: ["in_preparation"],
  in_preparation: ["internal_review"],
  internal_review: ["approved", "in_preparation"],
  approved: ["submitted"],
  submitted: ["accepted", "closed"],
  accepted: ["closed"],
  overdue: ["in_preparation", "closed"],
  closed: [],
};

export const COMMITMENT_TRANSITIONS: Record<string, string[]> = {
  open: ["in_progress", "cancelled"],
  in_progress: ["pending_evidence", "completed", "overdue", "cancelled"],
  pending_evidence: ["completed", "in_progress"],
  overdue: ["in_progress", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const ARTWORK_TRANSITIONS: Record<string, string[]> = {
  draft: ["ra_review"],
  ra_review: ["customer_review", "rejected"],
  customer_review: ["approved", "rejected", "ra_review"],
  approved: ["superseded"],
  rejected: ["draft"],
  superseded: [],
};

export const CHANGE_TRANSITIONS: Record<string, string[]> = {
  new_requirement: ["ra_assessment"],
  ra_assessment: ["impact_assessment"],
  impact_assessment: ["department_review"],
  department_review: ["action_plan"],
  action_plan: ["implementation"],
  implementation: ["verification"],
  verification: ["closed"],
  closed: [],
};

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}
