export const COMPLAINT_TRANSITIONS: Record<string, string[]> = {
  received: ["triage", "cancelled"],
  triage: ["investigation_pending", "cancelled"],
  investigation_pending: ["under_investigation"],
  under_investigation: ["qa_review", "investigation_pending"],
  qa_review: ["capa_pending", "recall_assessment", "customer_response_pending", "closure_review"],
  capa_pending: ["recall_assessment", "customer_response_pending", "closure_review"],
  recall_assessment: ["customer_response_pending", "closure_review"],
  customer_response_pending: ["closure_review"],
  closure_review: ["closed", "qa_review"],
  closed: ["reopened"],
  reopened: ["triage", "under_investigation"],
  cancelled: [],
};

export const INVESTIGATION_TRANSITIONS: Record<string, string[]> = {
  not_started: ["initiated"],
  initiated: ["in_progress"],
  in_progress: ["pending_evidence", "qa_review"],
  pending_evidence: ["in_progress"],
  qa_review: ["completed", "in_progress"],
  completed: ["closed"],
  closed: [],
};

export const TASK_TRANSITIONS: Record<string, string[]> = {
  assigned: ["in_progress", "cancelled"],
  in_progress: ["pending_evidence", "completed", "overdue"],
  pending_evidence: ["completed", "in_progress"],
  overdue: ["in_progress", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const SAMPLE_TRANSITIONS: Record<string, string[]> = {
  expected: ["received"],
  received: ["logged"],
  logged: ["under_testing", "retained"],
  under_testing: ["testing_complete"],
  testing_complete: ["retained", "disposed"],
  retained: ["disposed"],
  disposed: [],
};

export const RECALL_TRANSITIONS: Record<string, string[]> = {
  potential: ["assessment"],
  assessment: ["qa_review"],
  qa_review: ["management_approval"],
  management_approval: ["regulatory_review"],
  regulatory_review: ["initiated"],
  initiated: ["notification"],
  notification: ["retrieval"],
  retrieval: ["reconciliation"],
  reconciliation: ["effectiveness_check"],
  effectiveness_check: ["closed"],
  closed: [],
};

export const WITHDRAWAL_TRANSITIONS: Record<string, string[]> = {
  proposed: ["assessment"],
  assessment: ["qa_review"],
  qa_review: ["approved"],
  approved: ["customer_notification"],
  customer_notification: ["recovery"],
  recovery: ["reconciliation"],
  reconciliation: ["closed"],
  closed: [],
};

export const NOTIFICATION_TRANSITIONS: Record<string, string[]> = {
  assessment_pending: ["required", "not_required"],
  required: ["preparing"],
  not_required: ["closed"],
  preparing: ["approved"],
  approved: ["submitted"],
  submitted: ["acknowledged"],
  acknowledged: ["closed"],
  closed: [],
};

export const COMMUNICATION_TRANSITIONS: Record<string, string[]> = {
  draft: ["review"],
  review: ["approved", "draft"],
  approved: ["sent"],
  sent: ["acknowledged"],
  acknowledged: [],
};

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}
