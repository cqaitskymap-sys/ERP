export const PUTAWAY_TRANSITIONS: Record<string, string[]> = {
  created: ["assigned", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["confirmed", "cancelled"],
  confirmed: [],
  cancelled: [],
};

export const MOVEMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ["requested", "cancelled"],
  requested: ["approved", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

export const PICK_TRANSITIONS: Record<string, string[]> = {
  created: ["assigned", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["picked", "cancelled"],
  picked: ["verified"],
  verified: [],
  cancelled: [],
};

export const PACK_TRANSITIONS: Record<string, string[]> = {
  created: ["packing", "cancelled"],
  packing: ["verified", "cancelled"],
  verified: ["complete"],
  complete: [],
  cancelled: [],
};

export const SHIPMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ["ready", "cancelled"],
  ready: ["packed", "cancelled"],
  packed: ["dispatched", "cancelled"],
  dispatched: ["in_transit", "delayed", "returned"],
  in_transit: ["delivered", "delayed", "returned"],
  delayed: ["in_transit", "delivered", "returned"],
  delivered: [],
  cancelled: [],
  returned: [],
};

export const RETURN_TRANSITIONS: Record<string, string[]> = {
  requested: ["approved", "rejected"],
  approved: ["in_transit", "received"],
  in_transit: ["received"],
  received: ["quarantine"],
  quarantine: ["under_investigation", "qa_review"],
  under_investigation: ["qa_review"],
  qa_review: ["accepted", "rejected", "disposed"],
  accepted: ["closed"],
  rejected: ["disposed", "closed"],
  disposed: ["closed"],
  closed: [],
};

export const COUNT_TRANSITIONS: Record<string, string[]> = {
  planned: ["assigned", "cancelled"],
  assigned: ["counting", "cancelled"],
  counting: ["verification", "cancelled"],
  verification: ["approved", "cancelled"],
  approved: ["reconciled"],
  reconciled: [],
  cancelled: [],
};

export const EXCURSION_TRANSITIONS: Record<string, string[]> = {
  potential: ["detected"],
  detected: ["notified"],
  notified: ["qa_assessment"],
  qa_assessment: ["investigation", "released", "hold", "rejected"],
  investigation: ["capa_required", "released", "hold", "rejected"],
  capa_required: ["closed"],
  released: ["closed"],
  hold: ["investigation", "closed"],
  rejected: ["closed"],
  closed: [],
};

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}
