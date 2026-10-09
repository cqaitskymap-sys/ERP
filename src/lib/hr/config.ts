export const DEFAULT_CURRENCY = "INR";
export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_LATE_GRACE_MINUTES = 15;
export const DEFAULT_PAYROLL_ROUNDING = "nearest_paisa";

export const HR_NUMBER_SERIES = {
  EMP: { documentType: "HR-EMP", prefix: "EMP" },
  REQ: { documentType: "HR-REQ", prefix: "JRQ" },
  CAND: { documentType: "HR-CAND", prefix: "CND" },
  ATT: { documentType: "HR-ATT", prefix: "ATT" },
  LV: { documentType: "HR-LV", prefix: "LV" },
  OT: { documentType: "HR-OT", prefix: "OT" },
  PAY: { documentType: "HR-PAY", prefix: "PAY" },
  PSL: { documentType: "HR-PSL", prefix: "PSL" },
  HREQ: { documentType: "HR-HREQ", prefix: "HRQ" },
  SEP: { documentType: "HR-SEP", prefix: "SEP" },
  TRN: { documentType: "HR-TRN", prefix: "TRN" },
} as const;

export const WORKFLOW_MODULES = {
  leave: "hr_leave",
  overtime: "hr_overtime",
  payroll: "hr_payroll",
  recruitment: "hr_recruitment",
  separation: "hr_separation",
  attendanceCorrection: "hr_attendance_correction",
  employeeRequest: "hr_employee_request",
} as const;
