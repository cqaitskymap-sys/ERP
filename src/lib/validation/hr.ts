import { z } from "zod";
import {
  ATTENDANCE_STATUSES,
  EMPLOYEE_REQUEST_TYPES,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  LEAVE_LEDGER_ENTRY_TYPES,
} from "@/types/hr";

const optionalText = z.string().trim().optional().or(z.literal(""));
const moneyField = z.union([z.number(), z.string()]).optional();

export const hrSettingsSchema = z.object({
  timezone: z.string().trim().min(1).default("Asia/Kolkata"),
  currency: z.string().trim().min(1).default("INR"),
  lateGraceMinutes: z.coerce.number().int().min(0).max(240).default(15),
  requireManagerLeaveApproval: z.boolean().default(true),
  requireHrLeaveApproval: z.boolean().default(false),
  overtimeEligibleByDefault: z.boolean().default(false),
  payrollRequiresFinanceApproval: z.boolean().default(true),
  deactivateAccessOnSeparation: z.boolean().default(true),
  statutoryDisclaimer: z.string().trim().optional(),
});

export const designationSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  departmentId: optionalText,
  description: optionalText,
  grade: optionalText,
  status: z.enum(["active", "inactive"]).default("active"),
  idempotencyKey: optionalText,
});

export const employeeProfileSchema = z.object({
  employeeCode: z.string().trim().min(1).max(40).optional(),
  fullName: z.string().trim().min(1).max(160),
  officialEmail: z.string().trim().email().optional().or(z.literal("")),
  phone: optionalText,
  photoURL: optionalText,
  userId: optionalText,
  departmentId: optionalText,
  designationId: optionalText,
  reportingManagerId: optionalText,
  workLocationId: optionalText,
  facilityId: optionalText,
  costCenterId: optionalText,
  employmentType: z.enum(EMPLOYMENT_TYPES).default("permanent"),
  joiningDate: z.string().trim().min(1),
  probationEndDate: optionalText,
  shiftId: optionalText,
  jobDescriptionRef: optionalText,
  trainingProfileId: optionalText,
  contractRef: optionalText,
  emergencyContactName: optionalText,
  emergencyContactPhone: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const requisitionSchema = z.object({
  title: z.string().trim().min(1).max(160),
  departmentId: z.string().trim().min(1),
  designationId: optionalText,
  headcount: z.coerce.number().int().min(1).max(999).default(1),
  requiredQualifications: optionalText,
  requiredExperience: optionalText,
  hiringManagerId: optionalText,
  justification: optionalText,
  targetJoiningDate: optionalText,
  idempotencyKey: optionalText,
});

export const candidateSchema = z.object({
  requisitionId: z.string().trim().min(1),
  fullName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: optionalText,
  experienceYears: z.coerce.number().min(0).max(60).optional(),
  qualifications: optionalText,
  interviewNotes: optionalText,
  documentRefs: z.array(z.string()).optional(),
  idempotencyKey: optionalText,
});

export const onboardingTaskSchema = z.object({
  employeeId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160),
  category: z
    .enum(["documents", "training", "access", "assets", "induction", "probation", "other"])
    .default("other"),
  dueDate: optionalText,
  assignedTo: optionalText,
  documentRef: optionalText,
  trainingAssignmentId: optionalText,
  idempotencyKey: optionalText,
});

export const shiftSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  startTime: z.string().trim().regex(/^\d{1,2}:\d{2}$/),
  endTime: z.string().trim().regex(/^\d{1,2}:\d{2}$/),
  breakMinutes: z.coerce.number().int().min(0).max(480).default(0),
  overnight: z.boolean().default(false),
  weeklyOffs: z.array(z.string()).optional(),
  departmentId: optionalText,
  status: z.enum(["active", "inactive"]).default("active"),
  idempotencyKey: optionalText,
});

export const shiftAssignmentSchema = z.object({
  employeeId: z.string().trim().min(1),
  shiftId: z.string().trim().min(1),
  effectiveFrom: z.string().trim().min(1),
  effectiveTo: optionalText,
  rosterId: optionalText,
  idempotencyKey: optionalText,
});

export const attendanceSchema = z.object({
  employeeId: z.string().trim().min(1),
  attendanceDate: z.string().trim().min(1),
  shiftId: optionalText,
  checkIn: optionalText,
  checkOut: optionalText,
  breakMinutes: z.coerce.number().int().min(0).max(480).optional(),
  status: z.enum(ATTENDANCE_STATUSES).default("present"),
  sourceType: z.enum(["manual", "biometric", "import", "system"]).default("manual"),
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const attendanceCorrectionSchema = z.object({
  attendanceId: z.string().trim().min(1),
  revisedCheckIn: optionalText,
  revisedCheckOut: optionalText,
  revisedStatus: z.enum(ATTENDANCE_STATUSES).optional(),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: optionalText,
});

export const leavePolicySchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  annualEntitlement: z.coerce.number().min(0).max(366),
  accrualPerMonth: z.coerce.number().min(0).max(31).optional(),
  carryForwardMax: z.coerce.number().min(0).max(366).optional(),
  requiresDocument: z.boolean().default(false),
  paid: z.boolean().default(true),
  status: z.enum(["active", "inactive"]).default("active"),
  idempotencyKey: optionalText,
});

export const leaveApplicationSchema = z.object({
  employeeId: z.string().trim().min(1),
  leavePolicyId: z.string().trim().min(1),
  fromDate: z.string().trim().min(1),
  toDate: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(1000),
  documentRef: optionalText,
  idempotencyKey: optionalText,
});

export const overtimeSchema = z.object({
  employeeId: z.string().trim().min(1),
  overtimeDate: z.string().trim().min(1),
  shiftId: optionalText,
  attendanceId: optionalText,
  overtimeMinutes: z.coerce.number().int().min(1).max(24 * 60),
  reason: z.string().trim().min(1).max(500),
  departmentId: optionalText,
  idempotencyKey: optionalText,
});

export const compensationSchema = z.object({
  employeeId: z.string().trim().min(1),
  effectiveFrom: z.string().trim().min(1),
  effectiveTo: optionalText,
  basic: moneyField,
  hra: moneyField,
  otherAllowances: moneyField,
  currency: z.string().trim().default("INR"),
  overtimeEligible: z.boolean().default(false),
  payFrequency: z.enum(["monthly", "weekly", "biweekly"]).default("monthly"),
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const payrollRunSchema = z.object({
  periodFrom: z.string().trim().min(1),
  periodTo: z.string().trim().min(1),
  departmentId: optionalText,
  facilityId: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const statutoryRuleSchema = z.object({
  name: z.string().trim().min(1).max(160),
  effectiveFrom: z.string().trim().min(1),
  effectiveTo: optionalText,
  pfEmployeeRate: z.coerce.number().min(0).max(1).default(0),
  pfEmployerRate: z.coerce.number().min(0).max(1).default(0),
  pfWageCeiling: moneyField,
  esiEmployeeRate: z.coerce.number().min(0).max(1).default(0),
  esiEmployerRate: z.coerce.number().min(0).max(1).default(0),
  esiWageCeiling: moneyField,
  professionalTax: moneyField,
  notes: optionalText,
  reviewedBy: optionalText,
  idempotencyKey: optionalText,
});

export const employeeRequestSchema = z.object({
  requestType: z.enum(EMPLOYEE_REQUEST_TYPES),
  description: z.string().trim().min(1).max(2000),
  employeeId: optionalText,
  documentRefs: z.array(z.string()).optional(),
  idempotencyKey: optionalText,
});

export const separationSchema = z.object({
  employeeId: z.string().trim().min(1),
  separationType: z.enum(["resignation", "termination", "end_of_contract", "retirement", "other"]),
  requestedLastWorkingDay: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(2000),
  noticePeriodDays: z.coerce.number().int().min(0).max(365).optional(),
  idempotencyKey: optionalText,
});

export const trainingCourseSchema = z.object({
  code: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(200),
  category: z.enum(["gmp", "gdp", "sop", "safety", "role", "induction", "other"]).default("other"),
  mandatory: z.boolean().default(false),
  validityDays: z.coerce.number().int().min(0).max(3650).optional(),
  documentRef: optionalText,
  status: z.enum(["active", "inactive"]).default("active"),
  idempotencyKey: optionalText,
});

export const trainingAssignmentSchema = z.object({
  employeeId: z.string().trim().min(1),
  courseId: z.string().trim().min(1),
  dueDate: optionalText,
  departmentId: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const trainingCompletionSchema = z.object({
  assignmentId: z.string().trim().min(1),
  completedAt: z.string().trim().min(1),
  score: z.coerce.number().min(0).max(100).optional(),
  certificateRef: optionalText,
  evidenceRef: z.string().trim().min(1),
  trainerId: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const employmentStatusSchema = z.object({
  status: z.enum(EMPLOYMENT_STATUSES),
  reason: optionalText,
});

export const leaveLedgerSchema = z.object({
  employeeId: z.string().trim().min(1),
  leavePolicyId: z.string().trim().min(1),
  entryType: z.enum(LEAVE_LEDGER_ENTRY_TYPES),
  days: z.coerce.number().min(0).max(366),
  effectiveDate: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(500),
  applicationId: optionalText,
  idempotencyKey: optionalText,
});
