export const EMPLOYMENT_TYPES = [
  "permanent",
  "contract",
  "temporary",
  "trainee",
  "apprentice",
  "consultant",
  "other",
] as const;

export const EMPLOYMENT_STATUSES = [
  "draft",
  "onboarding",
  "active",
  "on_leave",
  "suspended",
  "notice_period",
  "separated",
  "archived",
] as const;

export const RECRUITMENT_STATUSES = [
  "draft",
  "department_review",
  "hr_review",
  "approved",
  "recruitment_open",
  "interviews",
  "selection",
  "offer",
  "accepted",
  "rejected",
  "onboarding",
  "cancelled",
] as const;

export const ONBOARDING_TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "waived",
  "cancelled",
] as const;

export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "late",
  "half_day",
  "on_leave",
  "weekly_off",
  "holiday",
  "remote",
] as const;

export const CORRECTION_STATUSES = [
  "submitted",
  "approved",
  "rejected",
  "cancelled",
] as const;

export const LEAVE_APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "manager_review",
  "hr_review",
  "approved",
  "rejected",
  "cancelled",
] as const;

export const OVERTIME_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "included_in_payroll",
  "cancelled",
] as const;

export const PAYROLL_RUN_STATUSES = [
  "draft",
  "input_validation",
  "calculated",
  "exception_review",
  "hr_review",
  "finance_review",
  "approved",
  "finalized",
  "payment_referenced",
  "reconciled",
  "cancelled",
] as const;

export const EMPLOYEE_REQUEST_STATUSES = [
  "submitted",
  "assigned",
  "under_review",
  "awaiting_information",
  "approved",
  "rejected",
  "completed",
  "closed",
  "cancelled",
] as const;

export const SEPARATION_STATUSES = [
  "initiated",
  "manager_review",
  "hr_review",
  "department_clearance",
  "asset_clearance",
  "finance_clearance",
  "access_deactivation",
  "final_approval",
  "closed",
  "cancelled",
] as const;

export const CLEARANCE_TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "waived",
] as const;

export const TRAINING_ASSIGNMENT_STATUSES = [
  "assigned",
  "in_progress",
  "completed",
  "overdue",
  "cancelled",
] as const;

export const EMPLOYEE_REQUEST_TYPES = [
  "profile_correction",
  "leave",
  "attendance_correction",
  "shift_change",
  "salary_certificate",
  "employment_certificate",
  "document",
  "asset_handover",
  "general",
] as const;

export const LEAVE_LEDGER_ENTRY_TYPES = [
  "entitlement",
  "accrual",
  "usage",
  "adjustment",
  "carry_forward",
  "lapse",
] as const;

export const HR_REPORT_TYPES = [
  "employee_directory",
  "attendance_summary",
  "overtime_summary",
  "leave_balance",
  "leave_utilization",
  "payroll_register",
  "department_payroll",
  "payroll_exceptions",
  "headcount",
  "joining_separation",
  "training_compliance",
  "statutory_summary",
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];
export type RecruitmentStatus = (typeof RECRUITMENT_STATUSES)[number];
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export type LeaveApplicationStatus = (typeof LEAVE_APPLICATION_STATUSES)[number];
export type PayrollRunStatus = (typeof PAYROLL_RUN_STATUSES)[number];
export type EmployeeRequestStatus = (typeof EMPLOYEE_REQUEST_STATUSES)[number];
export type SeparationStatus = (typeof SEPARATION_STATUSES)[number];
export type HrReportType = (typeof HR_REPORT_TYPES)[number];
