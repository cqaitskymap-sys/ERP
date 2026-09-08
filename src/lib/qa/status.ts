export const REVIEW_TRANSITIONS: Record<string, string[]> = {
  pending_review: ["under_review"],
  under_review: ["review_complete", "decision_pending", "held", "released", "rejected"],
  review_complete: ["decision_pending"],
  decision_pending: ["released", "held", "rejected"],
  released: ["closed"],
  held: ["under_review", "decision_pending", "released", "rejected"],
  rejected: ["closed"],
  closed: [],
};

export const DEVIATION_TRANSITIONS: Record<string, string[]> = {
  open: ["investigation", "closed"],
  investigation: ["qa_review", "capa_required"],
  qa_review: ["capa_required", "action_pending", "closed"],
  capa_required: ["action_pending"],
  action_pending: ["effectiveness_review", "closed"],
  effectiveness_review: ["closed", "action_pending"],
  closed: [],
};

export const CAPA_TRANSITIONS: Record<string, string[]> = {
  draft: ["open"],
  open: ["action_in_progress"],
  action_in_progress: ["effectiveness_review", "overdue"],
  overdue: ["action_in_progress", "effectiveness_review"],
  effectiveness_review: ["closed", "action_in_progress"],
  closed: [],
};

export const CHANGE_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["impact_assessment"],
  impact_assessment: ["qa_review"],
  qa_review: ["approved", "rejected"],
  approved: ["implementation"],
  implementation: ["verification"],
  verification: ["closed"],
  closed: [],
  rejected: [],
};

export const DOCUMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ["under_review", "obsolete"],
  under_review: ["approved", "draft"],
  approved: ["effective"],
  effective: ["superseded", "obsolete"],
  superseded: [],
  obsolete: [],
};

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}
