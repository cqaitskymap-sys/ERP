export const QUOTATION_TRANSITIONS: Record<string, string[]> = {
  draft: ["internal_review", "cancelled"],
  internal_review: ["pending_approval", "approved", "draft", "cancelled"],
  pending_approval: ["approved", "rejected", "draft"],
  approved: ["sent", "cancelled"],
  sent: ["negotiation", "accepted", "rejected", "expired"],
  negotiation: ["sent", "accepted", "rejected", "expired"],
  accepted: ["converted"],
  rejected: [],
  expired: [],
  converted: [],
  cancelled: [],
};

export const ORDER_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["under_review", "pending_approval", "cancelled"],
  under_review: ["pending_approval", "approved", "on_hold", "draft", "cancelled"],
  pending_approval: ["approved", "under_review", "draft", "cancelled"],
  approved: ["confirmed", "on_hold", "cancelled"],
  confirmed: ["in_production", "ready_for_dispatch", "on_hold", "cancelled"],
  on_hold: ["under_review", "confirmed", "cancelled"],
  in_production: ["awaiting_qa_release", "on_hold", "cancelled"],
  awaiting_qa_release: ["ready_for_dispatch", "on_hold"],
  ready_for_dispatch: ["partially_fulfilled", "dispatched", "on_hold"],
  partially_fulfilled: ["dispatched", "partially_delivered", "delivered", "ready_for_dispatch"],
  dispatched: ["partially_delivered", "delivered", "partially_fulfilled"],
  partially_delivered: ["delivered", "closed"],
  delivered: ["closed"],
  cancelled: [],
  closed: [],
};

export const CMO_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["technical_review", "cancelled"],
  technical_review: ["regulatory_review", "qa_review", "commercially_confirmed", "draft", "cancelled"],
  regulatory_review: ["qa_review", "commercially_confirmed", "technical_review", "cancelled"],
  qa_review: ["commercially_confirmed", "technical_review", "cancelled"],
  commercially_confirmed: ["linked_to_production", "cancelled"],
  linked_to_production: ["in_production", "cancelled"],
  in_production: ["awaiting_qa_release"],
  awaiting_qa_release: ["ready_for_dispatch"],
  ready_for_dispatch: ["fulfilled"],
  fulfilled: ["closed"],
  cancelled: [],
  closed: [],
};

export const RETURN_TRANSITIONS: Record<string, string[]> = {
  requested: ["sales_review", "rejected", "cancelled"],
  sales_review: ["qa_assessment", "authorized", "rejected", "cancelled"],
  qa_assessment: ["authorized", "rejected", "cancelled"],
  authorized: ["received", "cancelled"],
  received: ["quarantine"],
  quarantine: ["qa_disposition"],
  qa_disposition: ["commercial_resolution"],
  commercial_resolution: ["closed"],
  closed: [],
  rejected: [],
  cancelled: [],
};

export const REQUIREMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ["under_review", "cancelled"],
  under_review: ["approved", "rejected", "draft"],
  approved: ["active", "superseded"],
  active: ["superseded", "expired"],
  superseded: [],
  rejected: ["draft"],
  expired: [],
  cancelled: [],
};

export const PRICE_LIST_TRANSITIONS: Record<string, string[]> = {
  draft: ["active", "cancelled"],
  active: ["superseded", "expired", "cancelled"],
  superseded: [],
  expired: [],
  cancelled: [],
};

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}

/** Terminal / locked commercial order statuses that cannot return to draft. */
export const LOCKED_ORDER_STATUSES = [
  "dispatched",
  "partially_delivered",
  "delivered",
  "closed",
  "cancelled",
] as const;

export function isLockedOrderStatus(status: string) {
  return (LOCKED_ORDER_STATUSES as readonly string[]).includes(status);
}

export function isOpenOrderStatus(status: string) {
  return !["cancelled", "closed", "delivered"].includes(status);
}
