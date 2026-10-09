export const STANDARD_TRANSITIONS: Record<string, string[]> = {
  draft: ["calculated", "cancelled"],
  calculated: ["validation", "draft", "cancelled"],
  validation: ["department_review", "costing_review", "rejected", "draft"],
  department_review: ["costing_review", "rejected", "draft"],
  costing_review: ["finance_review", "approved", "rejected", "draft"],
  finance_review: ["approved", "rejected", "draft"],
  approved: ["finalized", "superseded", "cancelled"],
  finalized: ["superseded"],
  superseded: [],
  rejected: ["draft"],
  cancelled: [],
};

export const BATCH_COSTING_TRANSITIONS: Record<string, string[]> = {
  draft: ["calculated", "cancelled"],
  calculated: ["validation", "draft", "cancelled"],
  validation: ["department_review", "costing_review", "rejected", "draft"],
  department_review: ["costing_review", "rejected", "draft"],
  costing_review: ["finance_review", "approved", "rejected", "draft"],
  finance_review: ["approved", "rejected", "draft"],
  approved: ["finalized", "cancelled"],
  finalized: ["reconciled", "superseded"],
  reconciled: [],
  superseded: [],
  rejected: ["draft"],
  cancelled: [],
};

export const INVESTIGATION_TRANSITIONS: Record<string, string[]> = {
  draft: ["under_review", "cancelled"],
  under_review: ["pending_approval", "closed", "cancelled"],
  pending_approval: ["approved", "rejected", "under_review"],
  approved: ["closed"],
  rejected: ["under_review"],
  closed: [],
  cancelled: [],
};

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}

export function isFinalizedLocked(status: string) {
  return ["finalized", "reconciled", "superseded"].includes(status);
}
