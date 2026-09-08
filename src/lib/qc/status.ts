export const SAMPLE_REQUEST_TRANSITIONS: Record<string, string[]> = {
  draft: ["requested", "cancelled"],
  requested: ["approved", "cancelled"],
  approved: ["sampling", "cancelled"],
  sampling: ["sampled", "cancelled"],
  sampled: ["received", "cancelled"],
  received: ["testing", "completed"],
  testing: ["completed"],
  completed: ["closed"],
  closed: [],
  cancelled: [],
};

export const SAMPLE_TRANSITIONS: Record<string, string[]> = {
  planned: ["sampled", "cancelled"],
  sampled: ["in_transit", "received", "cancelled"],
  in_transit: ["received", "cancelled"],
  received: ["registered", "disposed"],
  registered: ["testing", "retained"],
  testing: ["completed"],
  completed: ["retained", "disposed"],
  retained: ["disposed"],
  disposed: [],
  cancelled: [],
};

export const TEST_TRANSITIONS: Record<string, string[]> = {
  draft: ["requested", "cancelled"],
  requested: ["assigned", "cancelled"],
  assigned: ["in_testing", "cancelled"],
  in_testing: ["review_pending"],
  review_pending: ["completed", "rejected", "in_testing"],
  completed: [],
  rejected: ["requested"],
  cancelled: [],
};

export const SPEC_TRANSITIONS: Record<string, string[]> = {
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
