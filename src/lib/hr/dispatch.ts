import { HR_COLLECTIONS } from "@/lib/hr/collections";
import { isHrResource, type HrResource } from "@/lib/hr/http";
import { fail, listByField, text } from "@/lib/hr/helpers";
import {
  approveAttendanceCorrection,
  approveLeaveApplication,
  assignEmployeeShift,
  assignEmployeeTraining,
  completeOnboardingTask,
  createCandidate,
  createCompensationRecord,
  createDesignation,
  createEmployeeProfile,
  createEmployeeRequest,
  createJobRequisition,
  createLeavePolicy,
  createOnboardingWorkflow,
  createOvertimeRequest,
  createShiftDefinition,
  createTrainingCourse,
  initiateEmployeeSeparation,
  recordAttendance,
  recordTrainingCompletion,
  requestAttendanceCorrection,
  saveHrSettings,
  submitLeaveApplication,
  transitionEmployeeRequest,
  transitionEmployeeStatus,
  transitionOvertime,
  transitionRequisition,
  updateLeaveLedger,
} from "@/lib/hr/server";
import {
  approveStatutoryRule,
  completeClearanceTask,
  createPayrollRun,
  createStatutoryRuleVersion,
  transitionPayrollRun,
  transitionSeparation,
} from "@/lib/hr/server-ops";
import { readMasterDocument } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";

const COLLECTION_MAP: Partial<Record<HrResource, string>> = {
  employees: HR_COLLECTIONS.employees,
  designations: HR_COLLECTIONS.designations,
  requisitions: HR_COLLECTIONS.requisitions,
  candidates: HR_COLLECTIONS.candidates,
  onboarding: HR_COLLECTIONS.onboardingTasks,
  documents: HR_COLLECTIONS.documents,
  attendance: HR_COLLECTIONS.attendance,
  attendanceCorrections: HR_COLLECTIONS.attendanceCorrections,
  shifts: HR_COLLECTIONS.shifts,
  shiftAssignments: HR_COLLECTIONS.shiftAssignments,
  leavePolicies: HR_COLLECTIONS.leavePolicies,
  leave: HR_COLLECTIONS.leaveApplications,
  leaveLedger: HR_COLLECTIONS.leaveLedger,
  overtime: HR_COLLECTIONS.overtime,
  compensation: HR_COLLECTIONS.compensation,
  payroll: HR_COLLECTIONS.payrollRuns,
  payslips: HR_COLLECTIONS.payslips,
  statutoryRules: HR_COLLECTIONS.statutoryRules,
  requests: HR_COLLECTIONS.requests,
  separations: HR_COLLECTIONS.separations,
  trainingCourses: HR_COLLECTIONS.trainingCourses,
  trainingAssignments: HR_COLLECTIONS.trainingAssignments,
  trainingCompletions: HR_COLLECTIONS.trainingCompletions,
  settings: HR_COLLECTIONS.settings,
};

export async function createHrRecord(
  resource: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  if (!isHrResource(resource)) fail("Unknown HR resource.");
  if (resource === "employees") return createEmployeeProfile({ payload, session, idToken });
  if (resource === "designations") return createDesignation({ payload, session, idToken });
  if (resource === "requisitions") return createJobRequisition({ payload, session, idToken });
  if (resource === "candidates") return createCandidate({ payload, session, idToken });
  if (resource === "onboarding") return createOnboardingWorkflow({ payload, session, idToken });
  if (resource === "attendance") return recordAttendance({ payload, session, idToken });
  if (resource === "attendanceCorrections") return requestAttendanceCorrection({ payload, session, idToken });
  if (resource === "shifts") return createShiftDefinition({ payload, session, idToken });
  if (resource === "shiftAssignments") return assignEmployeeShift({ payload, session, idToken });
  if (resource === "leavePolicies") return createLeavePolicy({ payload, session, idToken });
  if (resource === "leave") return submitLeaveApplication({ payload, session, idToken });
  if (resource === "leaveLedger") return updateLeaveLedger({ payload, session, idToken });
  if (resource === "overtime") return createOvertimeRequest({ payload, session, idToken });
  if (resource === "compensation") return createCompensationRecord({ payload, session, idToken });
  if (resource === "payroll") return createPayrollRun({ payload, session, idToken });
  if (resource === "statutoryRules") return createStatutoryRuleVersion({ payload, session, idToken });
  if (resource === "requests") return createEmployeeRequest({ payload, session, idToken });
  if (resource === "separations") return initiateEmployeeSeparation({ payload, session, idToken });
  if (resource === "trainingCourses") return createTrainingCourse({ payload, session, idToken });
  if (resource === "trainingAssignments") return assignEmployeeTraining({ payload, session, idToken });
  if (resource === "trainingCompletions") return recordTrainingCompletion({ payload, session, idToken });
  if (resource === "settings") return saveHrSettings({ payload, session, idToken });
  fail(`Cannot create ${resource} directly.`);
}

export async function loadHrDetail(
  resource: string,
  id: string,
  idToken: string,
  _session: SessionPayload
) {
  if (!isHrResource(resource)) fail("Unknown HR resource.");
  const collection = COLLECTION_MAP[resource];
  if (!collection) fail("Detail not available for this resource.");
  const record = await readMasterDocument(collection, id, idToken);
  if (!record) fail("Record was not found.");
  const extra: Record<string, unknown> = {};
  if (resource === "employees") {
    extra.onboarding = await listByField(HR_COLLECTIONS.onboardingTasks, "employeeId", id, idToken, 50);
    extra.leave = await listByField(HR_COLLECTIONS.leaveApplications, "employeeId", id, idToken, 20);
    extra.training = await listByField(HR_COLLECTIONS.trainingAssignments, "employeeId", id, idToken, 50);
  }
  if (resource === "payroll") {
    extra.entries = await listByField(HR_COLLECTIONS.payrollEntries, "payrollRunId", id, idToken, 500);
  }
  if (resource === "separations") {
    extra.clearance = await listByField(HR_COLLECTIONS.clearanceTasks, "separationId", id, idToken, 50);
  }
  return { record: { ...record, id }, extra };
}

export async function runHrAction(
  resource: string,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  if (!isHrResource(resource)) fail("Unknown HR resource.");
  const comment = text(payload.comment || payload.reason);

  if (resource === "employees" && action === "transition") {
    return transitionEmployeeStatus({
      id,
      toStatus: text(payload.toStatus),
      reason: comment,
      session,
      idToken,
    });
  }
  if (resource === "requisitions") {
    return transitionRequisition({ id, action, comment, session, idToken });
  }
  if (resource === "onboarding" && action === "complete") {
    return completeOnboardingTask({ id, comment, session, idToken });
  }
  if (resource === "attendanceCorrections" && (action === "approve" || action === "reject")) {
    return approveAttendanceCorrection({ id, action, comment, session, idToken });
  }
  if (resource === "leave") {
    return approveLeaveApplication({
      id,
      action: action as "approve" | "reject" | "submit_manager" | "submit_hr" | "cancel",
      comment,
      session,
      idToken,
    });
  }
  if (resource === "overtime") {
    return transitionOvertime({ id, action, comment, session, idToken });
  }
  if (resource === "payroll") {
    return transitionPayrollRun({
      id,
      action,
      comment,
      paymentReference: text(payload.paymentReference),
      session,
      idToken,
    });
  }
  if (resource === "statutoryRules" && action === "approve") {
    return approveStatutoryRule({ id, session, idToken, comment });
  }
  if (resource === "requests") {
    return transitionEmployeeRequest({ id, action, comment, session, idToken });
  }
  if (action === "complete_clearance" || action === "waive_clearance") {
    return completeClearanceTask({
      id: text(payload.taskId) || id,
      action: action === "waive_clearance" ? "waive" : "complete",
      comment,
      session,
      idToken,
    });
  }
  if (resource === "separations") {
    return transitionSeparation({ id, action, comment, session, idToken });
  }
  fail(`Unsupported action ${action} for ${resource}.`);
}
