import { HR_COLLECTIONS } from "@/lib/hr/collections";
import { DEFAULT_LATE_GRACE_MINUTES, DEFAULT_TIMEZONE } from "@/lib/hr/config";
import {
  calculateOvertime,
  calculateWorkingHours,
  datesOverlap,
  isLateArrival,
  leaveDaysInclusive,
  applyLeaveLedgerBalance,
  shiftsOverlap,
} from "@/lib/hr/calculate";
import {
  actorStamp,
  auditHr,
  commitWrites,
  dateOnly,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueHrNumber,
  listByField,
  notifyHr,
  parseOrFail,
  requireRecord,
  reuseIdempotent,
  searchIndex,
  text,
  writeOf,
} from "@/lib/hr/helpers";
import {
  EMPLOYMENT_TRANSITIONS,
  LEAVE_TRANSITIONS,
  OVERTIME_TRANSITIONS,
  RECRUITMENT_TRANSITIONS,
  REQUEST_TRANSITIONS,
  canTransition,
  isApprovedLeave,
  isTerminalEmployment,
} from "@/lib/hr/status";
import { queryMasterDocuments, readMasterDocument, type AtomicWrite } from "@/lib/masters/firestore";
import {
  attendanceCorrectionSchema,
  attendanceSchema,
  candidateSchema,
  compensationSchema,
  designationSchema,
  employeeProfileSchema,
  employeeRequestSchema,
  hrSettingsSchema,
  leaveApplicationSchema,
  leaveLedgerSchema,
  leavePolicySchema,
  onboardingTaskSchema,
  overtimeSchema,
  requisitionSchema,
  separationSchema,
  shiftAssignmentSchema,
  shiftSchema,
  trainingAssignmentSchema,
  trainingCompletionSchema,
  trainingCourseSchema,
} from "@/lib/validation/hr";
import type { SessionPayload } from "@/types/auth";

function assertTransition(map: Record<string, string[]>, current: string, next: string, label: string) {
  if (!canTransition(map, current, next)) fail(`Cannot ${label}: ${current} → ${next}.`);
}

export async function loadHrSettings(idToken: string) {
  const row = await readMasterDocument(HR_COLLECTIONS.settings, "default", idToken).catch(() => null);
  return {
    timezone: text(row?.timezone) || DEFAULT_TIMEZONE,
    currency: text(row?.currency) || "INR",
    lateGraceMinutes: Number(row?.lateGraceMinutes ?? DEFAULT_LATE_GRACE_MINUTES),
    requireManagerLeaveApproval: row?.requireManagerLeaveApproval !== false,
    requireHrLeaveApproval: Boolean(row?.requireHrLeaveApproval),
    overtimeEligibleByDefault: Boolean(row?.overtimeEligibleByDefault),
    payrollRequiresFinanceApproval: row?.payrollRequiresFinanceApproval !== false,
    deactivateAccessOnSeparation: row?.deactivateAccessOnSeparation !== false,
    statutoryDisclaimer:
      text(row?.statutoryDisclaimer) ||
      "Statutory calculations use configured rule versions and require qualified payroll/tax review before filing.",
  };
}

export async function saveHrSettings(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hr:update");
  const data = parseOrFail(hrSettingsSchema, options.payload);
  const record = { id: "default", ...data, ...actorStamp(options.session) };
  await commitWrites([writeOf(HR_COLLECTIONS.settings, "default", record)], options.idToken);
  await auditHr(options.idToken, options.session, {
    action: "HR_SETTINGS_SAVED",
    resource: HR_COLLECTIONS.settings,
    resourceId: "default",
    description: "Updated HR settings.",
  });
  return { id: "default", record };
}

async function assertUniqueEmployeeCode(code: string, idToken: string, excludeId?: string) {
  const rows = await queryMasterDocuments(HR_COLLECTIONS.employees, idToken, {
    filters: [{ field: "employeeCode", value: code }],
    limit: 5,
  }).catch(() => []);
  if (rows.some((row) => row.id !== excludeId)) fail(`Employee code ${code} already exists.`);
}

export async function createEmployeeProfile(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrEmployee:create");
  const data = parseOrFail(employeeProfileSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };

  if (data.userId) {
    const user = await readMasterDocument("users", data.userId, options.idToken);
    if (!user) fail("Linked user account was not found.");
  }
  if (data.departmentId) {
    const dept = await readMasterDocument("departments", data.departmentId, options.idToken);
    if (!dept) fail("Department was not found. Use the existing departments master.");
  }

  let employeeCode = text(data.employeeCode);
  if (!employeeCode) {
    const numbered = await issueHrNumber("EMP", options.session, options.idToken);
    employeeCode = numbered.documentNumber;
  }
  await assertUniqueEmployeeCode(employeeCode, options.idToken);

  const id = crypto.randomUUID();
  const record = {
    employeeId: id,
    employeeCode,
    ...data,
    status: "draft",
    lifecycle: [{ at: new Date().toISOString(), status: "draft", by: options.session.uid }],
    searchIndex: searchIndex(employeeCode, data.fullName, data.officialEmail, data.phone),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(HR_COLLECTIONS.employees, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditHr(options.idToken, options.session, {
    action: "EMPLOYEE_CREATED",
    resource: HR_COLLECTIONS.employees,
    resourceId: id,
    description: `Created employee profile ${employeeCode}.`,
  });
  return { id, record };
}

export async function transitionEmployeeStatus(options: {
  id: string;
  toStatus: string;
  reason?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrEmployee:update");
  const current = await requireRecord(HR_COLLECTIONS.employees, options.id, options.idToken, "Employee");
  if (isTerminalEmployment(text(current.status)) && options.toStatus !== "archived") {
    fail("Separated or archived employees cannot return to operational status without an authorized reopen process.");
  }
  assertTransition(EMPLOYMENT_TRANSITIONS, text(current.status), options.toStatus, "change employment status");

  const lifecycle = Array.isArray(current.lifecycle) ? [...(current.lifecycle as unknown[])] : [];
  lifecycle.push({
    at: new Date().toISOString(),
    status: options.toStatus,
    by: options.session.uid,
    reason: options.reason || "",
  });
  const next = {
    ...current,
    status: options.toStatus,
    lifecycle,
    separationDate: options.toStatus === "separated" ? dateOnly() : current.separationDate || "",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.employees, options.id, next)], options.idToken);

  if (options.toStatus === "active" && text(current.userId)) {
    // Does not invent passwords; only flags linkage for admins/HR via notification.
    await notifyHr(options.idToken, options.session, {
      type: "hr_employee_activated",
      title: "Employee activated",
      message: `${text(current.fullName)} (${text(current.employeeCode)}) is active. Confirm Auth account status separately.`,
      module: "hr",
      resource: "employees",
      resourceId: options.id,
      severity: "info",
      audienceRoles: ["hr", "admin"],
    });
  }

  await auditHr(options.idToken, options.session, {
    action: "EMPLOYEE_STATUS",
    resource: HR_COLLECTIONS.employees,
    resourceId: options.id,
    description: `Employee ${text(current.employeeCode)}: ${text(current.status)} → ${options.toStatus}.`,
    reason: options.reason,
  });
  return { id: options.id, record: next };
}

export async function createDesignation(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hr:create");
  const data = parseOrFail(designationSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  const id = crypto.randomUUID();
  const record = {
    designationId: id,
    ...data,
    searchIndex: searchIndex(data.code, data.name),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(HR_COLLECTIONS.designations, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

async function resolveDepartment(value: string, idToken: string) {
  const direct = await readMasterDocument("departments", value, idToken);
  if (direct) return direct;
  const byCode = await queryMasterDocuments("departments", idToken, {
    filters: [{ field: "departmentCode", value }],
    limit: 2,
  });
  return byCode.length === 1 ? byCode[0] : null;
}

async function resolveDesignation(value: string, idToken: string) {
  const direct = await readMasterDocument(HR_COLLECTIONS.designations, value, idToken);
  if (direct) return direct;
  const byCode = await queryMasterDocuments(HR_COLLECTIONS.designations, idToken, {
    filters: [{ field: "code", value }],
    limit: 2,
  });
  return byCode.length === 1 ? byCode[0] : null;
}

export async function createJobRequisition(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrRecruitment:create");
  const data = parseOrFail(requisitionSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  const dept = await resolveDepartment(data.departmentId, options.idToken);
  if (!dept) fail("Department was not found. Select a department from Department Master.");
  let designationId = data.designationId || "";
  if (designationId) {
    const designation = await resolveDesignation(designationId, options.idToken);
    if (!designation) fail("Designation was not found. Leave it blank or select one from Designation Master.");
    designationId = text(designation.id);
  }
  const numbered = await issueHrNumber("REQ", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    requisitionId: id,
    requisitionNumber: numbered.documentNumber,
    ...data,
    departmentId: text(dept.id),
    designationId,
    status: "draft",
    searchIndex: searchIndex(numbered.documentNumber, data.title, text(dept.departmentCode), text(dept.departmentName)),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(HR_COLLECTIONS.requisitions, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditHr(options.idToken, options.session, {
    action: "REQUISITION_CREATED",
    resource: HR_COLLECTIONS.requisitions,
    resourceId: id,
    description: `Created job requisition ${numbered.documentNumber}.`,
  });
  return { id, record };
}

export async function transitionRequisition(options: {
  id: string;
  action: string;
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrRecruitment:update");
  const current = await requireRecord(HR_COLLECTIONS.requisitions, options.id, options.idToken, "Requisition");
  const actionMap: Record<string, string> = {
    submit_department: "department_review",
    submit_hr: "hr_review",
    approve: "approved",
    open: "recruitment_open",
    start_interviews: "interviews",
    select: "selection",
    offer: "offer",
    accept: "accepted",
    reject: "rejected",
    start_onboarding: "onboarding",
    cancel: "cancelled",
    reopen: "draft",
  };
  const nextStatus = actionMap[options.action];
  if (!nextStatus) fail(`Unsupported requisition action: ${options.action}`);
  assertTransition(RECRUITMENT_TRANSITIONS, text(current.status), nextStatus, options.action);
  const next = {
    ...current,
    status: nextStatus,
    lastComment: options.comment || "",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.requisitions, options.id, next)], options.idToken);
  await auditHr(options.idToken, options.session, {
    action: "REQUISITION_STATUS",
    resource: HR_COLLECTIONS.requisitions,
    resourceId: options.id,
    description: `Requisition ${text(current.requisitionNumber)}: ${text(current.status)} → ${nextStatus}.`,
    reason: options.comment,
  });
  return { id: options.id, record: next };
}

export async function createCandidate(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrRecruitment:create");
  const data = parseOrFail(candidateSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  await requireRecord(HR_COLLECTIONS.requisitions, data.requisitionId, options.idToken, "Requisition");
  const numbered = await issueHrNumber("CAND", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    candidateId: id,
    candidateNumber: numbered.documentNumber,
    ...data,
    status: "active",
    searchIndex: searchIndex(numbered.documentNumber, data.fullName, data.email),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(HR_COLLECTIONS.candidates, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function createOnboardingWorkflow(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrEmployee:update");
  const data = parseOrFail(onboardingTaskSchema, options.payload);
  const employee = await requireRecord(HR_COLLECTIONS.employees, data.employeeId, options.idToken, "Employee");
  const id = crypto.randomUUID();
  const record = {
    taskId: id,
    ...data,
    employeeCode: text(employee.employeeCode),
    status: "pending",
    searchIndex: searchIndex(data.title, employee.employeeCode, employee.fullName),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.onboardingTasks, id, record, { exists: false })], options.idToken);
  if (text(employee.status) === "draft") {
    await transitionEmployeeStatus({
      id: data.employeeId,
      toStatus: "onboarding",
      reason: "Onboarding task created",
      session: options.session,
      idToken: options.idToken,
    });
  }
  return { id, record };
}

export async function completeOnboardingTask(options: {
  id: string;
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrEmployee:update");
  const current = await requireRecord(HR_COLLECTIONS.onboardingTasks, options.id, options.idToken, "Onboarding task");
  if (text(current.status) === "completed") fail("Task is already completed.");
  if (text(current.trainingAssignmentId)) {
    const assignment = await readMasterDocument(
      HR_COLLECTIONS.trainingAssignments,
      text(current.trainingAssignmentId),
      options.idToken
    );
    if (assignment && text(assignment.status) !== "completed") {
      fail("Linked training assignment is not completed in the LMS. Do not mark training tasks complete without evidence.");
    }
  }
  const next = {
    ...current,
    status: "completed",
    completedAt: new Date().toISOString(),
    completedBy: options.session.uid,
    comment: options.comment || "",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.onboardingTasks, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function createShiftDefinition(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrAttendance:create");
  const data = parseOrFail(shiftSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  const hours = calculateWorkingHours({
    checkIn: data.startTime,
    checkOut: data.endTime,
    breakMinutes: data.breakMinutes,
    overnight: data.overnight,
  });
  if (!hours.valid) fail(hours.reason);
  const id = crypto.randomUUID();
  const record = {
    shiftId: id,
    ...data,
    shiftMinutes: hours.workedMinutes,
    searchIndex: searchIndex(data.code, data.name),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(HR_COLLECTIONS.shifts, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function assignEmployeeShift(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrAttendance:create");
  const data = parseOrFail(shiftAssignmentSchema, options.payload);
  await requireRecord(HR_COLLECTIONS.employees, data.employeeId, options.idToken, "Employee");
  const shift = await requireRecord(HR_COLLECTIONS.shifts, data.shiftId, options.idToken, "Shift");
  const existing = await listByField(HR_COLLECTIONS.shiftAssignments, "employeeId", data.employeeId, options.idToken, 50);
  for (const row of existing) {
    if (text(row.status) === "cancelled") continue;
    const from = text(row.effectiveFrom);
    const to = text(row.effectiveTo) || "9999-12-31";
    const nextTo = text(data.effectiveTo) || "9999-12-31";
    if (!datesOverlap(from, to, data.effectiveFrom, nextTo)) continue;
    const other = await readMasterDocument(HR_COLLECTIONS.shifts, text(row.shiftId), options.idToken);
    if (!other) continue;
    if (
      shiftsOverlap({
        aStart: text(shift.startTime),
        aEnd: text(shift.endTime),
        aOvernight: Boolean(shift.overnight),
        bStart: text(other.startTime),
        bEnd: text(other.endTime),
        bOvernight: Boolean(other.overnight),
      })
    ) {
      fail("Overlapping shift assignment detected for this employee.");
    }
  }
  const id = crypto.randomUUID();
  const record = {
    assignmentId: id,
    ...data,
    status: "active",
    searchIndex: searchIndex(data.employeeId, data.shiftId, data.effectiveFrom),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.shiftAssignments, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function recordAttendance(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrAttendance:create");
  const data = parseOrFail(attendanceSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };

  await requireRecord(HR_COLLECTIONS.employees, data.employeeId, options.idToken, "Employee");
  const duplicates = await queryMasterDocuments(HR_COLLECTIONS.attendance, options.idToken, {
    filters: [
      { field: "employeeId", value: data.employeeId },
      { field: "attendanceDate", value: data.attendanceDate },
    ],
    limit: 5,
  }).catch(() => []);
  if (duplicates.length) fail("Attendance already exists for this employee and date. Use a correction request.");

  const settings = await loadHrSettings(options.idToken);
  let shiftMinutes = 8 * 60;
  let shiftStart = "";
  let overnight = false;
  if (data.shiftId) {
    const shift = await requireRecord(HR_COLLECTIONS.shifts, data.shiftId, options.idToken, "Shift");
    shiftMinutes = Number(shift.shiftMinutes || 480);
    shiftStart = text(shift.startTime);
    overnight = Boolean(shift.overnight);
  }

  const hours = calculateWorkingHours({
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    breakMinutes: data.breakMinutes,
    overnight,
  });
  const late = isLateArrival({
    checkIn: data.checkIn,
    shiftStart,
    graceMinutes: settings.lateGraceMinutes,
  });
  const ot = calculateOvertime({
    workedMinutes: hours.workedMinutes,
    shiftMinutes,
    eligible: settings.overtimeEligibleByDefault,
  });

  const id = crypto.randomUUID();
  const record = {
    attendanceId: id,
    ...data,
    workedMinutes: hours.workedMinutes,
    workedHours: hours.workedHours,
    overtimeMinutes: ot.overtimeMinutes,
    lateArrival: late,
    status: late && data.status === "present" ? "late" : data.status,
    recordedAtUtc: new Date().toISOString(),
    searchIndex: searchIndex(data.employeeId, data.attendanceDate, data.status),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(HR_COLLECTIONS.attendance, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditHr(options.idToken, options.session, {
    action: "ATTENDANCE_RECORDED",
    resource: HR_COLLECTIONS.attendance,
    resourceId: id,
    description: `Attendance recorded for ${data.employeeId} on ${data.attendanceDate}.`,
  });
  return { id, record };
}

export async function requestAttendanceCorrection(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrAttendance:create");
  const data = parseOrFail(attendanceCorrectionSchema, options.payload);
  const attendance = await requireRecord(
    HR_COLLECTIONS.attendance,
    data.attendanceId,
    options.idToken,
    "Attendance"
  );
  const id = crypto.randomUUID();
  const record = {
    correctionId: id,
    ...data,
    employeeId: text(attendance.employeeId),
    attendanceDate: text(attendance.attendanceDate),
    originalCheckIn: text(attendance.checkIn),
    originalCheckOut: text(attendance.checkOut),
    originalStatus: text(attendance.status),
    status: "submitted",
    searchIndex: searchIndex(attendance.employeeId, attendance.attendanceDate),
    ...actorStamp(options.session),
  };
  await commitWrites(
    [writeOf(HR_COLLECTIONS.attendanceCorrections, id, record, { exists: false })],
    options.idToken
  );
  return { id, record };
}

export async function approveAttendanceCorrection(options: {
  id: string;
  action: "approve" | "reject";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrAttendance:approve");
  const correction = await requireRecord(
    HR_COLLECTIONS.attendanceCorrections,
    options.id,
    options.idToken,
    "Attendance correction"
  );
  if (text(correction.status) !== "submitted") fail("Correction is not pending approval.");
  if (options.action === "reject") {
    const next = {
      ...correction,
      status: "rejected",
      reviewComment: options.comment || "",
      reviewedBy: options.session.uid,
      reviewedAt: new Date().toISOString(),
      ...actorStamp(options.session, correction),
    };
    await commitWrites([writeOf(HR_COLLECTIONS.attendanceCorrections, options.id, next)], options.idToken);
    return { id: options.id, record: next };
  }

  const attendance = await requireRecord(
    HR_COLLECTIONS.attendance,
    text(correction.attendanceId),
    options.idToken,
    "Attendance"
  );
  const hours = calculateWorkingHours({
    checkIn: text(correction.revisedCheckIn) || text(attendance.checkIn),
    checkOut: text(correction.revisedCheckOut) || text(attendance.checkOut),
    breakMinutes: Number(attendance.breakMinutes || 0),
  });
  const revised = {
    ...attendance,
    checkIn: text(correction.revisedCheckIn) || text(attendance.checkIn),
    checkOut: text(correction.revisedCheckOut) || text(attendance.checkOut),
    status: text(correction.revisedStatus) || text(attendance.status),
    correctionId: options.id,
    correctedAt: new Date().toISOString(),
    workedMinutes: hours.workedMinutes,
    workedHours: hours.workedHours,
    ...actorStamp(options.session, attendance),
  };

  const nextCorrection = {
    ...correction,
    status: "approved",
    reviewComment: options.comment || "",
    reviewedBy: options.session.uid,
    reviewedAt: new Date().toISOString(),
    ...actorStamp(options.session, correction),
  };
  await commitWrites(
    [
      writeOf(HR_COLLECTIONS.attendance, text(correction.attendanceId), revised),
      writeOf(HR_COLLECTIONS.attendanceCorrections, options.id, nextCorrection),
    ],
    options.idToken
  );
  await auditHr(options.idToken, options.session, {
    action: "ATTENDANCE_CORRECTION_APPROVED",
    resource: HR_COLLECTIONS.attendanceCorrections,
    resourceId: options.id,
    description: "Attendance correction approved; original values retained on correction record.",
    oldData: {
      checkIn: correction.originalCheckIn,
      checkOut: correction.originalCheckOut,
      status: correction.originalStatus,
    },
    newData: {
      checkIn: revised.checkIn,
      checkOut: revised.checkOut,
      status: revised.status,
    },
    reason: options.comment,
  });
  return { id: options.id, record: nextCorrection };
}

export async function createLeavePolicy(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrLeave:create");
  const data = parseOrFail(leavePolicySchema, options.payload);
  const id = crypto.randomUUID();
  const record = {
    policyId: id,
    ...data,
    searchIndex: searchIndex(data.code, data.name),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.leavePolicies, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function updateLeaveLedger(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
  skipPermission?: boolean;
}) {
  if (!options.skipPermission) ensurePermission(options.session, "hrLeave:update");
  const data = parseOrFail(leaveLedgerSchema, options.payload);
  const prior = await queryMasterDocuments(HR_COLLECTIONS.leaveLedger, options.idToken, {
    filters: [
      { field: "employeeId", value: data.employeeId },
      { field: "leavePolicyId", value: data.leavePolicyId },
    ],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit: 1,
  }).catch(() => []);
  const previousBalance = Number(prior[0]?.balanceAfter ?? 0);
  const balanceAfter = applyLeaveLedgerBalance({
    previousBalance,
    entryType: data.entryType,
    days: data.days,
  });
  if (balanceAfter < 0) fail("Leave balance cannot go negative.");
  const id = crypto.randomUUID();
  const record = {
    ledgerId: id,
    ...data,
    previousBalance,
    balanceAfter,
    searchIndex: searchIndex(data.employeeId, data.leavePolicyId, data.entryType),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.leaveLedger, id, record, { exists: false })], options.idToken);
  return { id, record, balanceAfter };
}

export async function submitLeaveApplication(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrLeave:create");
  const data = parseOrFail(leaveApplicationSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };

  await requireRecord(HR_COLLECTIONS.employees, data.employeeId, options.idToken, "Employee");
  await requireRecord(HR_COLLECTIONS.leavePolicies, data.leavePolicyId, options.idToken, "Leave policy");
  const days = leaveDaysInclusive(data.fromDate, data.toDate);
  if (days <= 0) fail("Leave date range is invalid.");

  const existing = await listByField(
    HR_COLLECTIONS.leaveApplications,
    "employeeId",
    data.employeeId,
    options.idToken,
    100
  );
  for (const row of existing) {
    if (!["approved", "submitted", "manager_review", "hr_review"].includes(text(row.status))) continue;
    if (datesOverlap(data.fromDate, data.toDate, text(row.fromDate), text(row.toDate))) {
      fail("Overlapping leave application exists for this employee.");
    }
  }

  const settings = await loadHrSettings(options.idToken);
  const numbered = await issueHrNumber("LV", options.session, options.idToken);
  const id = crypto.randomUUID();
  const initialStatus = settings.requireManagerLeaveApproval
    ? "submitted"
    : settings.requireHrLeaveApproval
      ? "hr_review"
      : "approved";
  const record = {
    applicationId: id,
    applicationNumber: numbered.documentNumber,
    ...data,
    days,
    status: initialStatus,
    balanceDeducted: false,
    searchIndex: searchIndex(numbered.documentNumber, data.employeeId, data.fromDate),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(HR_COLLECTIONS.leaveApplications, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);

  if (initialStatus === "approved") {
    await approveLeaveApplication({
      id,
      action: "approve",
      session: options.session,
      idToken: options.idToken,
      skipTransitionCheck: true,
    });
  }
  return { id, record };
}

export async function approveLeaveApplication(options: {
  id: string;
  action: "approve" | "reject" | "submit_manager" | "submit_hr" | "cancel";
  comment?: string;
  session: SessionPayload;
  idToken: string;
  skipTransitionCheck?: boolean;
}) {
  ensurePermission(
    options.session,
    options.action === "approve" || options.action === "reject" ? "hrLeave:approve" : "hrLeave:update"
  );
  const current = await requireRecord(
    HR_COLLECTIONS.leaveApplications,
    options.id,
    options.idToken,
    "Leave application"
  );
  const map: Record<string, string> = {
    submit_manager: "manager_review",
    submit_hr: "hr_review",
    approve: "approved",
    reject: "rejected",
    cancel: "cancelled",
  };
  const nextStatus = map[options.action];
  if (!nextStatus) fail(`Unsupported leave action: ${options.action}`);
  if (!options.skipTransitionCheck) {
    assertTransition(LEAVE_TRANSITIONS, text(current.status), nextStatus, options.action);
  }

  let next: Record<string, unknown> = {
    ...current,
    status: nextStatus,
    reviewComment: options.comment || "",
    reviewedBy: options.session.uid,
    reviewedAt: new Date().toISOString(),
    ...actorStamp(options.session, current),
  };

  if (nextStatus === "approved" && !current.balanceDeducted) {
    await updateLeaveLedger({
      payload: {
        employeeId: text(current.employeeId),
        leavePolicyId: text(current.leavePolicyId),
        entryType: "usage",
        days: Number(current.days || 0),
        effectiveDate: text(current.fromDate),
        reason: `Leave ${text(current.applicationNumber)} approved`,
        applicationId: options.id,
      },
      session: options.session,
      idToken: options.idToken,
      skipPermission: true,
    });
    next = { ...next, balanceDeducted: true };
  }

  await commitWrites([writeOf(HR_COLLECTIONS.leaveApplications, options.id, next)], options.idToken);
  await auditHr(options.idToken, options.session, {
    action: "LEAVE_DECISION",
    resource: HR_COLLECTIONS.leaveApplications,
    resourceId: options.id,
    description: `Leave ${text(current.applicationNumber)} → ${nextStatus}.`,
    reason: options.comment,
  });
  return { id: options.id, record: next };
}

export async function createOvertimeRequest(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrAttendance:create");
  const data = parseOrFail(overtimeSchema, options.payload);
  const employee = await requireRecord(HR_COLLECTIONS.employees, data.employeeId, options.idToken, "Employee");
  const compensation = await queryMasterDocuments(HR_COLLECTIONS.compensation, options.idToken, {
    filters: [{ field: "employeeId", value: data.employeeId }],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit: 1,
  }).catch(() => []);
  const settings = await loadHrSettings(options.idToken);
  const eligible =
    compensation[0]?.overtimeEligible === true ||
    (compensation.length === 0 && settings.overtimeEligibleByDefault);
  if (!eligible) fail("Employee is not eligible for overtime under configured compensation/policy.");

  const numbered = await issueHrNumber("OT", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    overtimeId: id,
    overtimeNumber: numbered.documentNumber,
    ...data,
    employeeCode: text(employee.employeeCode),
    status: "submitted",
    payrollIncluded: false,
    searchIndex: searchIndex(numbered.documentNumber, data.employeeId, data.overtimeDate),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.overtime, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function transitionOvertime(options: {
  id: string;
  action: string;
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrAttendance:approve");
  const current = await requireRecord(HR_COLLECTIONS.overtime, options.id, options.idToken, "Overtime");
  const map: Record<string, string> = {
    approve: "approved",
    reject: "rejected",
    include_payroll: "included_in_payroll",
    cancel: "cancelled",
    resubmit: "submitted",
  };
  const nextStatus = map[options.action];
  if (!nextStatus) fail(`Unsupported overtime action: ${options.action}`);
  assertTransition(OVERTIME_TRANSITIONS, text(current.status), nextStatus, options.action);
  if (nextStatus === "included_in_payroll" && current.payrollIncluded) {
    fail("Overtime already included in payroll.");
  }
  const next = {
    ...current,
    status: nextStatus,
    payrollIncluded: nextStatus === "included_in_payroll" ? true : current.payrollIncluded,
    reviewComment: options.comment || "",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.overtime, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function createCompensationRecord(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrPayroll:create");
  const data = parseOrFail(compensationSchema, options.payload);
  await requireRecord(HR_COLLECTIONS.employees, data.employeeId, options.idToken, "Employee");
  const id = crypto.randomUUID();
  const record = {
    compensationId: id,
    ...data,
    status: "active",
    searchIndex: searchIndex(data.employeeId, data.effectiveFrom),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.compensation, id, record, { exists: false })], options.idToken);
  await auditHr(options.idToken, options.session, {
    action: "COMPENSATION_CREATED",
    resource: HR_COLLECTIONS.compensation,
    resourceId: id,
    description: `Compensation record created for ${data.employeeId}.`,
    severity: "warning",
  });
  return { id, record };
}

export async function createEmployeeRequest(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hr:create");
  const data = parseOrFail(employeeRequestSchema, options.payload);
  const employeeId = text(data.employeeId) || options.session.uid;
  const numbered = await issueHrNumber("HREQ", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    requestId: id,
    requestNumber: numbered.documentNumber,
    ...data,
    employeeId,
    requesterUserId: options.session.uid,
    status: "submitted",
    searchIndex: searchIndex(numbered.documentNumber, data.requestType, employeeId),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.requests, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function transitionEmployeeRequest(options: {
  id: string;
  action: string;
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hr:update");
  const current = await requireRecord(HR_COLLECTIONS.requests, options.id, options.idToken, "HR request");
  const map: Record<string, string> = {
    assign: "assigned",
    review: "under_review",
    await_info: "awaiting_information",
    approve: "approved",
    reject: "rejected",
    complete: "completed",
    close: "closed",
    cancel: "cancelled",
  };
  const nextStatus = map[options.action];
  if (!nextStatus) fail(`Unsupported request action: ${options.action}`);
  assertTransition(REQUEST_TRANSITIONS, text(current.status), nextStatus, options.action);
  const next = {
    ...current,
    status: nextStatus,
    lastComment: options.comment || "",
    closedAt: nextStatus === "closed" ? new Date().toISOString() : current.closedAt || "",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.requests, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function initiateEmployeeSeparation(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "hrSeparation:create");
  const data = parseOrFail(separationSchema, options.payload);
  const employee = await requireRecord(HR_COLLECTIONS.employees, data.employeeId, options.idToken, "Employee");
  if (isTerminalEmployment(text(employee.status))) fail("Employee is already separated or archived.");
  const numbered = await issueHrNumber("SEP", options.session, options.idToken);
  const id = crypto.randomUUID();
  const clearanceDefaults = ["department", "assets", "finance", "access", "documents"];
  const writes: AtomicWrite[] = [];
  const clearanceIds: string[] = [];
  for (const category of clearanceDefaults) {
    const taskId = crypto.randomUUID();
    clearanceIds.push(taskId);
    writes.push(
      writeOf(
        HR_COLLECTIONS.clearanceTasks,
        taskId,
        {
          taskId,
          separationId: id,
          employeeId: data.employeeId,
          category,
          title: `${category} clearance`,
          status: "pending",
          ...actorStamp(options.session),
        },
        { exists: false }
      )
    );
  }
  const record = {
    separationId: id,
    separationNumber: numbered.documentNumber,
    ...data,
    employeeCode: text(employee.employeeCode),
    status: "initiated",
    clearanceTaskIds: clearanceIds,
    accessDeactivated: false,
    searchIndex: searchIndex(numbered.documentNumber, employee.employeeCode, employee.fullName),
    ...actorStamp(options.session),
  };
  writes.unshift(writeOf(HR_COLLECTIONS.separations, id, record, { exists: false }));
  await commitWrites(writes, options.idToken);
  await transitionEmployeeStatus({
    id: data.employeeId,
    toStatus: "notice_period",
    reason: `Separation ${numbered.documentNumber} initiated`,
    session: options.session,
    idToken: options.idToken,
  });
  await auditHr(options.idToken, options.session, {
    action: "SEPARATION_INITIATED",
    resource: HR_COLLECTIONS.separations,
    resourceId: id,
    description: `Separation ${numbered.documentNumber} initiated.`,
  });
  return { id, record };
}

export async function createTrainingCourse(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "training:create");
  const data = parseOrFail(trainingCourseSchema, options.payload);
  const id = crypto.randomUUID();
  const record = {
    courseId: id,
    ...data,
    searchIndex: searchIndex(data.code, data.title, data.category),
    ...actorStamp(options.session),
  };
  await commitWrites([writeOf(HR_COLLECTIONS.trainingCourses, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function assignEmployeeTraining(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "training:create");
  const data = parseOrFail(trainingAssignmentSchema, options.payload);
  await requireRecord(HR_COLLECTIONS.employees, data.employeeId, options.idToken, "Employee");
  await requireRecord(HR_COLLECTIONS.trainingCourses, data.courseId, options.idToken, "Training course");
  const numbered = await issueHrNumber("TRN", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    assignmentId: id,
    assignmentNumber: numbered.documentNumber,
    ...data,
    status: "assigned",
    completionId: "",
    searchIndex: searchIndex(numbered.documentNumber, data.employeeId, data.courseId),
    ...actorStamp(options.session),
  };
  await commitWrites(
    [writeOf(HR_COLLECTIONS.trainingAssignments, id, record, { exists: false })],
    options.idToken
  );
  return { id, record };
}

export async function recordTrainingCompletion(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "training:approve");
  const data = parseOrFail(trainingCompletionSchema, options.payload);
  if (!text(data.evidenceRef)) fail("Training evidence reference is required. Do not mark complete without LMS evidence.");
  const assignment = await requireRecord(
    HR_COLLECTIONS.trainingAssignments,
    data.assignmentId,
    options.idToken,
    "Training assignment"
  );
  if (text(assignment.status) === "completed") fail("Assignment already completed.");
  const id = crypto.randomUUID();
  const completion = {
    completionId: id,
    ...data,
    employeeId: text(assignment.employeeId),
    courseId: text(assignment.courseId),
    status: "recorded",
    ...actorStamp(options.session),
  };
  const nextAssignment = {
    ...assignment,
    status: "completed",
    completionId: id,
    completedAt: data.completedAt,
    ...actorStamp(options.session, assignment),
  };
  await commitWrites(
    [
      writeOf(HR_COLLECTIONS.trainingCompletions, id, completion, { exists: false }),
      writeOf(HR_COLLECTIONS.trainingAssignments, data.assignmentId, nextAssignment),
    ],
    options.idToken
  );
  // Optional denormalized hint for production/QC eligibility — not a fabricated qualification.
  if (text(assignment.employeeId)) {
    const employee = await readMasterDocument(HR_COLLECTIONS.employees, text(assignment.employeeId), options.idToken);
    if (employee?.userId) {
      const user = await readMasterDocument("users", text(employee.userId), options.idToken);
      if (user) {
        await commitWrites(
          [
            writeOf("users", text(employee.userId), {
              ...user,
              trainingStatus: "trained",
              updatedAt: new Date().toISOString(),
              updatedBy: options.session.uid,
            }),
          ],
          options.idToken
        );
      }
    }
  }
  await auditHr(options.idToken, options.session, {
    action: "TRAINING_COMPLETED",
    resource: HR_COLLECTIONS.trainingCompletions,
    resourceId: id,
    description: `Training completion recorded with evidence ${data.evidenceRef}.`,
  });
  return { id, record: completion };
}

export { isApprovedLeave };
