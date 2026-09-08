export const INTAKE_TRANSITIONS: Record<string, string[]> = {
  received: ["triage_pending", "converted_to_case", "duplicate", "invalid", "closed"],
  triage_pending: ["converted_to_case", "duplicate", "invalid", "closed"],
  converted_to_case: [],
  duplicate: ["closed"],
  invalid: ["closed"],
  closed: [],
};

export const CASE_TRANSITIONS: Record<string, string[]> = {
  new: ["triage"],
  triage: ["processing", "closed"],
  processing: ["medical_review", "follow_up_required"],
  medical_review: ["follow_up_required", "regulatory_review", "closed"],
  follow_up_required: ["processing", "medical_review", "follow_up_pending"],
  regulatory_review: ["reporting", "follow_up_required", "closed"],
  reporting: ["follow_up_pending", "closed"],
  follow_up_pending: ["processing", "closed"],
  closed: ["reopened"],
  reopened: ["triage", "processing"],
};

export const FOLLOWUP_TRANSITIONS: Record<string, string[]> = {
  requested: ["pending", "cancelled"],
  pending: ["received", "overdue", "cancelled"],
  received: ["under_review"],
  under_review: ["closed", "pending"],
  overdue: ["received", "closed", "cancelled"],
  closed: [],
  cancelled: [],
};

export const REPORT_TRANSITIONS: Record<string, string[]> = {
  assessment_pending: ["required", "not_required"],
  required: ["preparing"],
  not_required: ["closed"],
  preparing: ["internal_review"],
  internal_review: ["approved", "preparing"],
  approved: ["submitted"],
  submitted: ["acknowledged", "rejected"],
  acknowledged: ["closed"],
  rejected: ["preparing", "closed"],
  closed: [],
};

export const SIGNAL_TRANSITIONS: Record<string, string[]> = {
  detected: ["screening"],
  screening: ["assessment", "closed"],
  assessment: ["confirmed", "monitoring", "closed"],
  confirmed: ["monitoring"],
  monitoring: ["closed"],
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

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}
