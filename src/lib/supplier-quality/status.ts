export const PROFILE_TRANSITIONS: Record<string, string[]> = {
  not_assessed: ["screening"],
  screening: ["qualification_pending", "under_evaluation"],
  qualification_pending: ["under_evaluation", "audit_required"],
  under_evaluation: ["audit_required", "qa_review"],
  audit_required: ["under_audit"],
  under_audit: ["qa_review"],
  qa_review: ["approved", "conditional_approval", "qualification_pending"],
  approved: ["expired", "suspended", "disqualified", "under_evaluation"],
  conditional_approval: ["approved", "expired", "suspended", "disqualified"],
  expired: ["qualification_pending", "under_evaluation"],
  suspended: ["qualification_pending", "disqualified", "approved"],
  disqualified: [],
};

export const QUALIFICATION_TRANSITIONS: Record<string, string[]> = {
  draft: ["screening"],
  screening: ["document_collection"],
  document_collection: ["questionnaire"],
  questionnaire: ["evaluation"],
  evaluation: ["audit_required", "qa_review"],
  audit_required: ["under_audit"],
  under_audit: ["qa_review"],
  qa_review: ["approved", "conditional", "rejected"],
  approved: ["expired"],
  conditional: ["approved", "expired", "rejected"],
  rejected: ["draft"],
  expired: ["draft"],
};

export const QUESTIONNAIRE_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent"],
  sent: ["supplier_response"],
  supplier_response: ["internal_review"],
  internal_review: ["clarification", "final_review"],
  clarification: ["supplier_response"],
  final_review: ["approved", "rejected"],
  approved: [],
  rejected: ["draft"],
};

export const AUDIT_TRANSITIONS: Record<string, string[]> = {
  planned: ["approved"],
  approved: ["scheduled"],
  scheduled: ["in_progress"],
  in_progress: ["findings_recorded"],
  findings_recorded: ["supplier_response"],
  supplier_response: ["qa_review"],
  qa_review: ["capa_pending", "follow_up", "closed"],
  capa_pending: ["follow_up", "closed"],
  follow_up: ["closed"],
  closed: [],
};

export const CHANGE_TRANSITIONS: Record<string, string[]> = {
  received: ["qa_review"],
  qa_review: ["impact_assessment"],
  impact_assessment: ["approval"],
  approval: ["implementation"],
  implementation: ["verification"],
  verification: ["closed"],
  closed: [],
};

export const SUSPENSION_TRANSITIONS: Record<string, string[]> = {
  proposed: ["qa_review"],
  qa_review: ["approved"],
  approved: ["suspended"],
  suspended: ["reactivated", "disqualified"],
  reactivated: [],
  disqualified: [],
};

export const REQUAL_TRANSITIONS: Record<string, string[]> = {
  not_started: ["planning"],
  planning: ["document_review"],
  document_review: ["evaluation"],
  evaluation: ["audit", "qa_review"],
  audit: ["qa_review"],
  qa_review: ["approved", "rejected"],
  approved: [],
  rejected: ["planning"],
  overdue: ["planning", "document_review"],
};

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}
