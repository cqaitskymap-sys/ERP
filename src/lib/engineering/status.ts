export const EQUIPMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ["under_installation", "commissioning", "cancelled"],
  under_installation: ["commissioning", "out_of_service"],
  commissioning: ["in_service", "qualification_pending", "out_of_service"],
  in_service: [
    "maintenance_due",
    "under_maintenance",
    "calibration_due",
    "under_calibration",
    "qualification_pending",
    "restricted",
    "out_of_service",
    "decommissioned",
  ],
  maintenance_due: ["under_maintenance", "in_service", "restricted", "out_of_service"],
  under_maintenance: ["in_service", "restricted", "out_of_service", "maintenance_due"],
  calibration_due: ["under_calibration", "restricted", "out_of_service"],
  under_calibration: ["in_service", "restricted", "out_of_service", "calibration_due"],
  qualification_pending: ["in_service", "restricted", "out_of_service"],
  restricted: ["under_calibration", "under_maintenance", "in_service", "out_of_service"],
  out_of_service: ["under_maintenance", "under_calibration", "commissioning", "decommissioned"],
  decommissioned: [],
  cancelled: [],
};

export const WORK_ORDER_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["review", "approved", "rejected", "draft"],
  review: ["approved", "rejected", "draft"],
  approved: ["assigned", "cancelled"],
  assigned: ["in_progress", "waiting_for_parts", "cancelled"],
  in_progress: ["waiting_for_parts", "work_completed", "cancelled"],
  waiting_for_parts: ["in_progress", "cancelled"],
  work_completed: ["engineering_review", "qa_review"],
  engineering_review: ["qa_review", "closed", "in_progress"],
  qa_review: ["closed", "in_progress"],
  closed: ["reopened"],
  rejected: ["draft"],
  cancelled: [],
  reopened: ["assigned", "in_progress", "cancelled"],
};

export const BREAKDOWN_TRANSITIONS: Record<string, string[]> = {
  reported: ["acknowledged", "cancelled"],
  acknowledged: ["under_repair", "awaiting_parts", "cancelled"],
  under_repair: ["awaiting_parts", "restored", "cancelled"],
  awaiting_parts: ["under_repair", "cancelled"],
  restored: ["qa_assessment", "closed"],
  qa_assessment: ["closed", "under_repair"],
  closed: [],
  cancelled: [],
};

export const CALIBRATION_TRANSITIONS: Record<string, string[]> = {
  scheduled: ["requested", "cancelled"],
  requested: ["approved", "in_progress", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["results_review", "cancelled"],
  results_review: ["passed", "failed", "out_of_tolerance", "in_progress"],
  passed: ["closed"],
  failed: ["out_of_tolerance", "closed"],
  out_of_tolerance: ["closed"],
  closed: [],
  cancelled: [],
};

export const QUALIFICATION_TRANSITIONS: Record<string, string[]> = {
  draft: ["protocol_approved", "cancelled"],
  protocol_approved: ["in_execution", "rejected"],
  in_execution: ["under_review", "rejected"],
  under_review: ["approved", "rejected", "in_execution"],
  approved: ["effective", "superseded"],
  effective: ["superseded"],
  rejected: ["draft"],
  superseded: [],
  cancelled: [],
};

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}

export function isLockedEquipmentStatus(status: string) {
  return ["decommissioned"].includes(status);
}

export function isClosedWorkOrder(status: string) {
  return ["closed", "cancelled"].includes(status);
}
