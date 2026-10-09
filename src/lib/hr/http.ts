import { HR_COLLECTIONS } from "@/lib/hr/collections";
import type { Permission } from "@/types/permissions";

export const HR_RESOURCES = {
  employees: {
    collection: HR_COLLECTIONS.employees,
    read: "hrEmployee:read" as Permission,
    create: "hrEmployee:create" as Permission,
  },
  designations: {
    collection: HR_COLLECTIONS.designations,
    read: "hr:read" as Permission,
    create: "hr:create" as Permission,
  },
  requisitions: {
    collection: HR_COLLECTIONS.requisitions,
    read: "hrRecruitment:read" as Permission,
    create: "hrRecruitment:create" as Permission,
  },
  candidates: {
    collection: HR_COLLECTIONS.candidates,
    read: "hrRecruitment:read" as Permission,
    create: "hrRecruitment:create" as Permission,
  },
  onboarding: {
    collection: HR_COLLECTIONS.onboardingTasks,
    read: "hrEmployee:read" as Permission,
    create: "hrEmployee:update" as Permission,
  },
  documents: {
    collection: HR_COLLECTIONS.documents,
    read: "hrEmployee:read" as Permission,
    create: "hrEmployee:update" as Permission,
  },
  attendance: {
    collection: HR_COLLECTIONS.attendance,
    read: "hrAttendance:read" as Permission,
    create: "hrAttendance:create" as Permission,
  },
  attendanceCorrections: {
    collection: HR_COLLECTIONS.attendanceCorrections,
    read: "hrAttendance:read" as Permission,
    create: "hrAttendance:create" as Permission,
  },
  shifts: {
    collection: HR_COLLECTIONS.shifts,
    read: "hrAttendance:read" as Permission,
    create: "hrAttendance:create" as Permission,
  },
  shiftAssignments: {
    collection: HR_COLLECTIONS.shiftAssignments,
    read: "hrAttendance:read" as Permission,
    create: "hrAttendance:create" as Permission,
  },
  rosters: {
    collection: HR_COLLECTIONS.rosters,
    read: "hrAttendance:read" as Permission,
    create: "hrAttendance:create" as Permission,
  },
  leavePolicies: {
    collection: HR_COLLECTIONS.leavePolicies,
    read: "hrLeave:read" as Permission,
    create: "hrLeave:create" as Permission,
  },
  leave: {
    collection: HR_COLLECTIONS.leaveApplications,
    read: "hrLeave:read" as Permission,
    create: "hrLeave:create" as Permission,
  },
  leaveLedger: {
    collection: HR_COLLECTIONS.leaveLedger,
    read: "hrLeave:read" as Permission,
    create: "hrLeave:update" as Permission,
  },
  overtime: {
    collection: HR_COLLECTIONS.overtime,
    read: "hrAttendance:read" as Permission,
    create: "hrAttendance:create" as Permission,
  },
  timesheets: {
    collection: HR_COLLECTIONS.timesheets,
    read: "hrAttendance:read" as Permission,
    create: "hrAttendance:create" as Permission,
  },
  compensation: {
    collection: HR_COLLECTIONS.compensation,
    read: "hrPayroll:read" as Permission,
    create: "hrPayroll:create" as Permission,
  },
  payroll: {
    collection: HR_COLLECTIONS.payrollRuns,
    read: "hrPayroll:read" as Permission,
    create: "hrPayroll:create" as Permission,
  },
  payslips: {
    collection: HR_COLLECTIONS.payslips,
    read: "hrPayroll:read" as Permission,
    create: "hrPayroll:create" as Permission,
  },
  statutoryRules: {
    collection: HR_COLLECTIONS.statutoryRules,
    read: "hrPayroll:read" as Permission,
    create: "hr:update" as Permission,
  },
  requests: {
    collection: HR_COLLECTIONS.requests,
    read: "hr:read" as Permission,
    create: "hr:create" as Permission,
  },
  separations: {
    collection: HR_COLLECTIONS.separations,
    read: "hrSeparation:read" as Permission,
    create: "hrSeparation:create" as Permission,
  },
  disciplinary: {
    collection: HR_COLLECTIONS.disciplinary,
    read: "hrEmployee:read" as Permission,
    create: "hrEmployee:update" as Permission,
  },
  performance: {
    collection: HR_COLLECTIONS.performance,
    read: "hrEmployee:read" as Permission,
    create: "hrEmployee:update" as Permission,
  },
  trainingCourses: {
    collection: HR_COLLECTIONS.trainingCourses,
    read: "training:read" as Permission,
    create: "training:create" as Permission,
  },
  trainingAssignments: {
    collection: HR_COLLECTIONS.trainingAssignments,
    read: "training:read" as Permission,
    create: "training:create" as Permission,
  },
  trainingCompletions: {
    collection: HR_COLLECTIONS.trainingCompletions,
    read: "training:read" as Permission,
    create: "training:approve" as Permission,
  },
  settings: {
    collection: HR_COLLECTIONS.settings,
    read: "hr:read" as Permission,
    create: "hr:update" as Permission,
  },
} as const;

export type HrResource = keyof typeof HR_RESOURCES;

export function isHrResource(value: string): value is HrResource {
  return value in HR_RESOURCES;
}

export const READ_ALIASES: Record<HrResource, Permission[]> = {
  employees: ["hrEmployee:read", "hr:read"],
  designations: ["hr:read", "hrEmployee:read"],
  requisitions: ["hrRecruitment:read", "hr:read"],
  candidates: ["hrRecruitment:read", "hr:read"],
  onboarding: ["hrEmployee:read", "hr:read"],
  documents: ["hrEmployee:read", "hr:read"],
  attendance: ["hrAttendance:read", "hr:read"],
  attendanceCorrections: ["hrAttendance:read", "hr:read"],
  shifts: ["hrAttendance:read", "hr:read"],
  shiftAssignments: ["hrAttendance:read", "hr:read"],
  rosters: ["hrAttendance:read", "hr:read"],
  leavePolicies: ["hrLeave:read", "hr:read"],
  leave: ["hrLeave:read", "hr:read"],
  leaveLedger: ["hrLeave:read", "hr:read"],
  overtime: ["hrAttendance:read", "hr:read"],
  timesheets: ["hrAttendance:read", "hr:read"],
  compensation: ["hrPayroll:read"],
  payroll: ["hrPayroll:read"],
  payslips: ["hrPayroll:read", "hr:read"],
  statutoryRules: ["hrPayroll:read", "hr:update"],
  requests: ["hr:read"],
  separations: ["hrSeparation:read", "hr:read"],
  disciplinary: ["hrEmployee:read"],
  performance: ["hrEmployee:read", "hr:read"],
  trainingCourses: ["training:read", "hr:read"],
  trainingAssignments: ["training:read", "hr:read"],
  trainingCompletions: ["training:read", "hr:read"],
  settings: ["hr:read", "hr:update"],
};
