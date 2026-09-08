export const PR_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["department_review", "rejected", "cancelled"],
  department_review: ["approved", "rejected"],
  approved: ["purchase_review", "cancelled"],
  purchase_review: ["rfq"],
  rfq: ["po"],
  po: ["completed"],
  rejected: ["submitted"],
  cancelled: [],
  completed: [],
};

export const RFQ_TRANSITIONS: Record<string, string[]> = {
  draft: ["issued", "cancelled"],
  issued: ["partially_responded", "fully_responded", "cancelled"],
  partially_responded: ["fully_responded", "evaluation", "cancelled"],
  fully_responded: ["evaluation", "cancelled"],
  evaluation: ["closed"],
  closed: [],
  cancelled: [],
};

export const QUOTATION_TRANSITIONS: Record<string, string[]> = {
  draft: ["received", "cancelled"],
  received: ["under_evaluation", "expired", "cancelled"],
  under_evaluation: ["selected", "not_selected", "expired"],
  selected: [],
  not_selected: [],
  expired: [],
  cancelled: [],
};

export const PO_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["under_approval", "cancelled"],
  under_approval: ["approved", "draft"],
  approved: ["sent", "cancelled"],
  sent: ["acknowledged", "cancelled"],
  acknowledged: ["partially_received", "fully_received"],
  partially_received: ["fully_received", "closed"],
  fully_received: ["closed"],
  closed: [],
  cancelled: [],
};

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}
