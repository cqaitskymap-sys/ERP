export const PLAN_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["under_review", "cancelled"],
  under_review: ["approved", "draft"],
  approved: ["scheduled", "cancelled"],
  scheduled: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

export const SCHEDULE_TRANSITIONS: Record<string, string[]> = {
  planned: ["scheduled", "cancelled"],
  scheduled: ["ready", "cancelled"],
  ready: ["in_progress", "cancelled"],
  in_progress: ["paused", "completed"],
  paused: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

export const MO_TRANSITIONS: Record<string, string[]> = {
  draft: ["planned", "cancelled"],
  planned: ["approved", "cancelled"],
  approved: ["ready", "cancelled"],
  ready: ["dispensing_pending", "manufacturing"],
  dispensing_pending: ["manufacturing", "cancelled"],
  manufacturing: ["in_process", "paused", "completed"],
  in_process: ["completed", "paused"],
  paused: ["manufacturing", "in_process"],
  completed: ["qc_pending"],
  qc_pending: ["qa_pending"],
  qa_pending: ["released", "held", "rejected"],
  held: ["qa_pending", "released", "rejected"],
  rejected: [],
  released: ["closed"],
  closed: [],
  cancelled: [],
};

export const BOM_TRANSITIONS: Record<string, string[]> = {
  draft: ["under_review", "obsolete"],
  under_review: ["approved", "draft"],
  approved: ["effective"],
  effective: ["superseded", "obsolete"],
  superseded: [],
  obsolete: [],
};

export const BMR_TRANSITIONS: Record<string, string[]> = {
  draft: ["issued"],
  issued: ["in_progress"],
  in_progress: ["paused", "completed"],
  paused: ["in_progress"],
  completed: ["reviewed"],
  reviewed: ["closed"],
  closed: [],
};

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}
