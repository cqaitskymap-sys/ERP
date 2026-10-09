import { HR_COLLECTIONS } from "@/lib/hr/collections";
import { HR_RESOURCES, type HrResource } from "@/lib/hr/http";
import { canViewPayroll, maskPayrollFields, text } from "@/lib/hr/helpers";
import {
  queryMasterDocuments,
  type MasterQueryFilter,
  type MasterRecord,
} from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";
import type { HrReportType } from "@/types/hr";

const SEARCH_END = "\uf8ff";

export interface HrListQuery {
  status?: string;
  departmentId?: string;
  designationId?: string;
  employeeId?: string;
  facilityId?: string;
  search?: string;
  from?: string;
  to?: string;
  pageSize?: number;
  cursor?: string;
}

function encodeCursor(values: Array<string | number>) {
  return Buffer.from(JSON.stringify(values), "utf8").toString("base64url");
}

function decodeCursor(cursor?: string) {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Array<string | number>;
  } catch {
    return undefined;
  }
}

function paginate(rows: MasterRecord[], pageSize: number, cursorOf: (row: MasterRecord) => Array<string | number>) {
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null,
  };
}

function maybeMask(resource: HrResource, rows: MasterRecord[], session: SessionPayload) {
  if (!["compensation", "payroll", "payslips"].includes(resource)) return rows;
  if (canViewPayroll(session)) return rows;
  return rows.map((row) => maskPayrollFields(row, session) as MasterRecord);
}

export async function listHrRecords(
  resource: HrResource,
  query: HrListQuery,
  idToken: string,
  session: SessionPayload
) {
  const collection = HR_RESOURCES[resource].collection;
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.departmentId) filters.push({ field: "departmentId", value: query.departmentId });
  if (query.designationId) filters.push({ field: "designationId", value: query.designationId });
  if (query.employeeId) filters.push({ field: "employeeId", value: query.employeeId });
  if (query.facilityId) filters.push({ field: "facilityId", value: query.facilityId });

  // Self-service: employees see own requests/payslips unless broader HR access
  if (
    ["requests", "payslips", "leave", "attendance"].includes(resource) &&
    !session.permissions.includes("hrEmployee:read") &&
    !session.permissions.includes("hr:update") &&
    !session.permissions.includes("hrPayroll:read")
  ) {
    filters.push({ field: resource === "requests" ? "requesterUserId" : "employeeId", value: session.uid });
  }

  const search = query.search?.trim().toLowerCase();
  const cursorValues = decodeCursor(query.cursor);
  let rows: MasterRecord[];
  if (search) {
    rows = await queryMasterDocuments(collection, idToken, {
      filters: [
        ...filters,
        { field: "searchIndex", op: "GREATER_THAN_OR_EQUAL", value: search },
        { field: "searchIndex", op: "LESS_THAN", value: `${search}${SEARCH_END}` },
      ],
      orderBy: [{ field: "searchIndex" }],
      startAfter: cursorValues,
      limit: pageSize + 1,
    });
  } else {
    rows = await queryMasterDocuments(collection, idToken, {
      filters,
      orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
      startAfter: cursorValues,
      limit: pageSize + 1,
    });
  }

  if (query.from || query.to) {
    rows = rows.filter((row) => {
      const date = text(
        row.attendanceDate || row.fromDate || row.periodFrom || row.overtimeDate || row.joiningDate || row.createdAt
      ).slice(0, 10);
      if (query.from && date < query.from) return false;
      if (query.to && date > query.to) return false;
      return true;
    });
  }

  const page = paginate(rows, pageSize, (row) =>
    search ? [text(row.searchIndex), String(row.id)] : [text(row.updatedAt), String(row.id)]
  );
  return { ...page, rows: maybeMask(resource, page.rows, session) };
}

export async function loadHrDashboard(
  query: { departmentId?: string; from?: string; to?: string; facilityId?: string },
  idToken: string,
  session: SessionPayload
) {
  const today = new Date().toISOString().slice(0, 10);
  const employees = await queryMasterDocuments(HR_COLLECTIONS.employees, idToken, { limit: 500 }).catch(() => []);
  const scoped = employees.filter((row) => {
    if (query.departmentId && text(row.departmentId) !== query.departmentId) return false;
    if (query.facilityId && text(row.facilityId) !== query.facilityId) return false;
    return true;
  });
  const active = scoped.filter((row) => text(row.status) === "active");
  const onLeave = scoped.filter((row) => text(row.status) === "on_leave");
  const onboarding = await queryMasterDocuments(HR_COLLECTIONS.onboardingTasks, idToken, {
    filters: [{ field: "status", value: "pending" }],
    limit: 200,
  }).catch(() => []);
  const leavePending = await queryMasterDocuments(HR_COLLECTIONS.leaveApplications, idToken, {
    filters: [{ field: "status", value: "submitted" }],
    limit: 100,
  }).catch(() => []);
  const attendanceToday = await queryMasterDocuments(HR_COLLECTIONS.attendance, idToken, {
    filters: [{ field: "attendanceDate", value: today }],
    limit: 500,
  }).catch(() => []);
  const present = attendanceToday.filter((row) => ["present", "late", "remote"].includes(text(row.status)));
  const absent = attendanceToday.filter((row) => text(row.status) === "absent");
  const late = attendanceToday.filter((row) => text(row.status) === "late" || row.lateArrival === true);
  const payrollRuns = await queryMasterDocuments(HR_COLLECTIONS.payrollRuns, idToken, { limit: 50 }).catch(() => []);
  const openPayroll = payrollRuns.filter((row) => !["finalized", "reconciled", "cancelled"].includes(text(row.status)));
  const separations = await queryMasterDocuments(HR_COLLECTIONS.separations, idToken, { limit: 50 }).catch(() => []);
  const openSeparations = separations.filter((row) => !["closed", "cancelled"].includes(text(row.status)));
  const training = await queryMasterDocuments(HR_COLLECTIONS.trainingAssignments, idToken, { limit: 300 }).catch(
    () => []
  );
  const trainingCompleted = training.filter((row) => text(row.status) === "completed");
  const trainingOverdue = training.filter(
    (row) => text(row.status) !== "completed" && text(row.dueDate) && text(row.dueDate) < today
  );

  const byDepartment: Record<string, number> = {};
  for (const row of active) {
    const key = text(row.departmentId) || "unassigned";
    byDepartment[key] = (byDepartment[key] || 0) + 1;
  }

  const stats: Record<string, unknown> = {
    totalActiveEmployees: active.length,
    newJoiners: scoped.filter(
      (row) => text(row.joiningDate) >= (query.from || today.slice(0, 8) + "01")
    ).length,
    employeesOnLeave: onLeave.length,
    attendancePresentToday: present.length,
    attendanceAbsentToday: absent.length,
    lateArrivalsToday: late.length,
    pendingLeaveApprovals: leavePending.length,
    pendingOnboardingTasks: onboarding.length,
    trainingCompleted: trainingCompleted.length,
    trainingOverdue: trainingOverdue.length,
    openPayrollRuns: openPayroll.length,
    openSeparations: openSeparations.length,
    departmentDistribution: byDepartment,
    asOf: today,
  };

  if (canViewPayroll(session)) {
    stats.payrollStatusSummary = openPayroll.map((row) => ({
      id: row.id,
      number: row.payrollNumber,
      status: row.status,
      periodFrom: row.periodFrom,
      periodTo: row.periodTo,
    }));
  } else {
    stats.payrollStatusSummary = "[restricted]";
  }

  return { stats };
}

export async function loadPendingHrApprovals(idToken: string, _session: SessionPayload) {
  const leave = await queryMasterDocuments(HR_COLLECTIONS.leaveApplications, idToken, {
    filters: [{ field: "status", value: "submitted" }],
    limit: 50,
  }).catch(() => []);
  const corrections = await queryMasterDocuments(HR_COLLECTIONS.attendanceCorrections, idToken, {
    filters: [{ field: "status", value: "submitted" }],
    limit: 50,
  }).catch(() => []);
  const overtime = await queryMasterDocuments(HR_COLLECTIONS.overtime, idToken, {
    filters: [{ field: "status", value: "submitted" }],
    limit: 50,
  }).catch(() => []);
  const payroll = await queryMasterDocuments(HR_COLLECTIONS.payrollRuns, idToken, {
    filters: [{ field: "status", value: "hr_review" }],
    limit: 20,
  }).catch(() => []);
  const rows = [
    ...leave.map((row) => ({ ...row, approvalType: "leave" })),
    ...corrections.map((row) => ({ ...row, approvalType: "attendance_correction" })),
    ...overtime.map((row) => ({ ...row, approvalType: "overtime" })),
    ...payroll.map((row) => ({ ...row, approvalType: "payroll" })),
  ];
  return { rows };
}

export async function loadHrReport(
  type: HrReportType,
  query: HrListQuery,
  idToken: string,
  session: SessionPayload
) {
  switch (type) {
    case "employee_directory":
      return listHrRecords("employees", query, idToken, session);
    case "attendance_summary":
      return listHrRecords("attendance", query, idToken, session);
    case "overtime_summary":
      return listHrRecords("overtime", query, idToken, session);
    case "leave_balance":
      return listHrRecords("leaveLedger", query, idToken, session);
    case "leave_utilization":
      return listHrRecords("leave", { ...query, status: "approved" }, idToken, session);
    case "payroll_register":
    case "department_payroll":
    case "payroll_exceptions":
    case "statutory_summary":
      return listHrRecords("payroll", query, idToken, session);
    case "headcount":
    case "joining_separation":
      return listHrRecords("employees", query, idToken, session);
    case "training_compliance":
      return listHrRecords("trainingAssignments", query, idToken, session);
    default:
      return { rows: [], nextCursor: null };
  }
}
