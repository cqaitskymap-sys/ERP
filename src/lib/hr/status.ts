export const EMPLOYMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ["onboarding", "archived", "cancelled"],
  onboarding: ["active", "draft", "separated"],
  active: ["on_leave", "suspended", "notice_period", "separated"],
  on_leave: ["active", "notice_period", "separated"],
  suspended: ["active", "notice_period", "separated"],
  notice_period: ["separated", "active"],
  separated: ["archived"],
  archived: [],
  cancelled: [],
};

export const RECRUITMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ["department_review", "cancelled"],
  department_review: ["hr_review", "draft", "rejected"],
  hr_review: ["approved", "draft", "rejected"],
  approved: ["recruitment_open", "cancelled"],
  recruitment_open: ["interviews", "cancelled"],
  interviews: ["selection", "recruitment_open", "cancelled"],
  selection: ["offer", "interviews", "rejected"],
  offer: ["accepted", "rejected", "selection"],
  accepted: ["onboarding"],
  onboarding: [],
  rejected: ["draft"],
  cancelled: [],
};

export const LEAVE_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["manager_review", "hr_review", "approved", "rejected", "cancelled"],
  manager_review: ["hr_review", "approved", "rejected", "submitted"],
  hr_review: ["approved", "rejected", "manager_review"],
  approved: ["cancelled"],
  rejected: ["draft"],
  cancelled: [],
};

export const OVERTIME_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "rejected", "cancelled"],
  approved: ["included_in_payroll", "cancelled"],
  rejected: ["draft"],
  included_in_payroll: [],
  cancelled: [],
};

export const PAYROLL_TRANSITIONS: Record<string, string[]> = {
  draft: ["input_validation", "cancelled"],
  input_validation: ["calculated", "draft", "cancelled"],
  calculated: ["exception_review", "hr_review", "cancelled"],
  exception_review: ["hr_review", "calculated"],
  hr_review: ["finance_review", "exception_review", "rejected"],
  finance_review: ["approved", "hr_review", "rejected"],
  approved: ["finalized", "finance_review"],
  finalized: ["payment_referenced"],
  payment_referenced: ["reconciled"],
  reconciled: [],
  rejected: ["draft"],
  cancelled: [],
};

export const REQUEST_TRANSITIONS: Record<string, string[]> = {
  submitted: ["assigned", "under_review", "cancelled"],
  assigned: ["under_review", "awaiting_information", "cancelled"],
  under_review: ["awaiting_information", "approved", "rejected", "completed"],
  awaiting_information: ["under_review", "cancelled"],
  approved: ["completed", "closed"],
  rejected: ["closed"],
  completed: ["closed"],
  closed: [],
  cancelled: [],
};

export const SEPARATION_TRANSITIONS: Record<string, string[]> = {
  initiated: ["manager_review", "cancelled"],
  manager_review: ["hr_review", "cancelled"],
  hr_review: ["department_clearance", "cancelled"],
  department_clearance: ["asset_clearance"],
  asset_clearance: ["finance_clearance"],
  finance_clearance: ["access_deactivation"],
  access_deactivation: ["final_approval"],
  final_approval: ["closed"],
  closed: [],
  cancelled: [],
};

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}

export function isTerminalEmployment(status: string) {
  return ["separated", "archived", "cancelled"].includes(status);
}

export function isFinalizedPayroll(status: string) {
  return ["finalized", "payment_referenced", "reconciled"].includes(status);
}

export function isApprovedLeave(status: string) {
  return status === "approved";
}
