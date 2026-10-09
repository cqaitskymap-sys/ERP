import {
  ATTENDANCE_STATUSES,
  EMPLOYEE_REQUEST_TYPES,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  HR_REPORT_TYPES,
  LEAVE_APPLICATION_STATUSES,
  OVERTIME_STATUSES,
  PAYROLL_RUN_STATUSES,
  RECRUITMENT_STATUSES,
  SEPARATION_STATUSES,
  TRAINING_ASSIGNMENT_STATUSES,
} from "@/types/hr";

function options(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  }));
}

export const employmentTypeOptions = options(EMPLOYMENT_TYPES);
export const employmentStatusOptions = options(EMPLOYMENT_STATUSES);
export const recruitmentStatusOptions = options(RECRUITMENT_STATUSES);
export const attendanceStatusOptions = options(ATTENDANCE_STATUSES);
export const leaveStatusOptions = options(LEAVE_APPLICATION_STATUSES);
export const overtimeStatusOptions = options(OVERTIME_STATUSES);
export const payrollStatusOptions = options(PAYROLL_RUN_STATUSES);
export const requestTypeOptions = options(EMPLOYEE_REQUEST_TYPES);
export const separationStatusOptions = options(SEPARATION_STATUSES);
export const trainingStatusOptions = options(TRAINING_ASSIGNMENT_STATUSES);
export const reportTypeOptions = options(HR_REPORT_TYPES);

export function labelFor(list: Array<{ value: string; label: string }>, value: unknown) {
  return list.find((item) => item.value === value)?.label || String(value ?? "—");
}

export function workflowTone(status: string): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  if (["active", "approved", "finalized", "completed", "closed", "present"].includes(status)) return "success";
  if (["rejected", "cancelled", "absent", "suspended"].includes(status)) return "critical";
  if (["draft", "submitted", "under_review", "hr_review", "manager_review", "calculated"].includes(status)) {
    return "warning";
  }
  if (["onboarding", "notice_period", "on_leave", "late"].includes(status)) return "info";
  return "neutral";
}
