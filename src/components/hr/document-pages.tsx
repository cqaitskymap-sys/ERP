"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { HrList } from "@/components/hr/hr-list";
import { HrReportsPage } from "@/components/hr/reports-page";
import {
  ALL_LEAVE_ACTIONS,
  ALL_OVERTIME_ACTIONS,
  ALL_PAYROLL_ACTIONS,
  ALL_REQUISITION_ACTIONS,
  ALL_REQUEST_ACTIONS,
  ALL_SEPARATION_ACTIONS,
  ATTENDANCE_CORRECTION_ACTIONS,
  EmployeeTransitionActions,
  HrWorkflowActions,
  ONBOARDING_ACTIONS,
  employmentStatusOptions,
  leaveStatusOptions,
  overtimeStatusOptions,
  payrollStatusOptions,
  recruitmentStatusOptions,
  separationStatusOptions,
} from "@/components/hr/workflow-actions";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { getHr } from "@/lib/hr/client";
import { labelFor, workflowTone } from "@/lib/hr/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

const P = {
  employee: "hrEmployee:read" as Permission,
  hr: "hr:read" as Permission,
  recruitment: "hrRecruitment:read" as Permission,
  attendance: "hrAttendance:read" as Permission,
  leave: "hrLeave:read" as Permission,
  payroll: "hrPayroll:read" as Permission,
  separation: "hrSeparation:read" as Permission,
  training: "training:read" as Permission,
};

export function EmployeeListPage() {
  return (
    <HrList
      title="Employees"
      description="Employee profiles with employment status and org links."
      resource="employees"
      permission={[P.employee, P.hr]}
      createHref="/hr/employees/new"
      createLabel="New employee"
      exportColumns={["employeeCode", "fullName", "departmentId", "designationId", "status", "joiningDate"]}
      columns={[
        { key: "employeeCode", header: "Code" },
        { key: "fullName", header: "Name" },
        { key: "departmentId", header: "Department", hideOnMobile: true },
        { key: "designationId", header: "Designation", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/hr/employees/${row.id}`}
    />
  );
}

export function EmployeeDirectoryListPage() {
  return (
    <HrList
      title="Directory"
      description="Company directory from live employee records."
      resource="employees"
      permission={[P.employee, P.hr]}
      exportColumns={["employeeCode", "fullName", "officialEmail", "phone", "departmentId", "status"]}
      columns={[
        { key: "fullName", header: "Name" },
        { key: "employeeCode", header: "Code", hideOnMobile: true },
        { key: "officialEmail", header: "Email", hideOnMobile: true },
        { key: "departmentId", header: "Department" },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/hr/employees/${row.id}`}
    />
  );
}

export function DesignationListPage() {
  return (
    <HrList
      title="Designations"
      description="Job titles and grades linked to departments."
      resource="designations"
      permission={P.hr}
      createHref="/hr/designations/new"
      createLabel="New designation"
      exportColumns={["code", "name", "departmentId", "grade", "status"]}
      columns={[
        { key: "code", header: "Code" },
        { key: "name", header: "Name" },
        { key: "departmentId", header: "Department", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/hr/designations"}
      disableRowClick
    />
  );
}

export function RequisitionListPage() {
  return (
    <HrList
      title="Recruitment"
      description="Job requisitions with department and HR approval workflow."
      resource="requisitions"
      permission={P.recruitment}
      createHref="/hr/recruitment/new"
      createLabel="New requisition"
      exportColumns={["requisitionNumber", "title", "departmentId", "headcount", "status"]}
      columns={[
        { key: "requisitionNumber", header: "REQ #" },
        { key: "title", header: "Title" },
        { key: "departmentId", header: "Department", hideOnMobile: true },
        { key: "headcount", header: "HC", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/hr/recruitment/${row.id}`}
    />
  );
}

export function CandidateListPage() {
  return (
    <HrList
      title="Candidates"
      description="Applicants linked to open requisitions."
      resource="candidates"
      permission={P.recruitment}
      createHref="/hr/candidates/new"
      createLabel="New candidate"
      exportColumns={["candidateNumber", "fullName", "requisitionId", "email", "status"]}
      columns={[
        { key: "candidateNumber", header: "CAND #" },
        { key: "fullName", header: "Name" },
        { key: "requisitionId", header: "Requisition", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/hr/candidates"}
      disableRowClick
    />
  );
}

export function OnboardingListPage() {
  return (
    <HrList
      title="Onboarding"
      description="Pending onboarding tasks by employee."
      resource="onboarding"
      permission={P.employee}
      createHref="/hr/onboarding/new"
      createLabel="New task"
      exportColumns={["title", "employeeId", "category", "dueDate", "status"]}
      columns={[
        { key: "title", header: "Task" },
        { key: "employeeId", header: "Employee" },
        { key: "category", header: "Category", hideOnMobile: true },
        { key: "dueDate", header: "Due", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/hr/onboarding"}
      disableRowClick
    />
  );
}

export function HrDocumentListPage() {
  return (
    <HrList
      title="Employee documents"
      description="HR document references linked to employees."
      resource="documents"
      permission={P.employee}
      exportColumns={["documentNumber", "title", "employeeId", "documentType", "status"]}
      columns={[
        { key: "documentNumber", header: "Doc #" },
        { key: "title", header: "Title" },
        { key: "employeeId", header: "Employee", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/hr/documents"}
      disableRowClick
    />
  );
}

export function AttendanceListPage({ title = "Attendance", description }: { title?: string; description?: string }) {
  return (
    <HrList
      title={title}
      description={description || "Daily attendance with check-in/out and status."}
      resource="attendance"
      permission={P.attendance}
      createHref="/hr/attendance/new"
      createLabel="Record attendance"
      exportColumns={["employeeId", "attendanceDate", "status", "checkIn", "checkOut", "workedHours"]}
      columns={[
        { key: "attendanceDate", header: "Date" },
        { key: "employeeId", header: "Employee" },
        { key: "status", header: "Status" },
        { key: "checkIn", header: "In", hideOnMobile: true },
        { key: "checkOut", header: "Out", hideOnMobile: true },
      ]}
      rowHref={() => "/hr/attendance"}
      disableRowClick
    />
  );
}

export function TimesheetsListPage() {
  return (
    <AttendanceListPage
      title="Timesheets"
      description="Attendance-based timesheet view for payroll and project costing."
    />
  );
}

export function ShiftListPage() {
  return (
    <HrList
      title="Shifts"
      description="Shift definitions for roster and attendance rules."
      resource="shifts"
      permission={P.attendance}
      createHref="/hr/shifts/new"
      createLabel="New shift"
      exportColumns={["code", "name", "startTime", "endTime", "status"]}
      columns={[
        { key: "code", header: "Code" },
        { key: "name", header: "Name" },
        { key: "startTime", header: "Start", hideOnMobile: true },
        { key: "endTime", header: "End", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/hr/shifts"}
      disableRowClick
    />
  );
}

export function RosterListPage() {
  return (
    <HrList
      title="Rosters"
      description="Shift assignments by employee and effective dates."
      resource="shiftAssignments"
      permission={P.attendance}
      exportColumns={["employeeId", "shiftId", "effectiveFrom", "effectiveTo", "status"]}
      columns={[
        { key: "employeeId", header: "Employee" },
        { key: "shiftId", header: "Shift" },
        { key: "effectiveFrom", header: "From", hideOnMobile: true },
        { key: "effectiveTo", header: "To", hideOnMobile: true },
      ]}
      rowHref={() => "/hr/rosters"}
      disableRowClick
    />
  );
}

export function OvertimeListPage() {
  return (
    <HrList
      title="Overtime"
      description="Overtime requests awaiting approval and payroll inclusion."
      resource="overtime"
      permission={P.attendance}
      createHref="/hr/overtime/new"
      createLabel="New overtime"
      exportColumns={["overtimeNumber", "employeeId", "overtimeDate", "overtimeMinutes", "status"]}
      columns={[
        { key: "overtimeNumber", header: "OT #" },
        { key: "employeeId", header: "Employee" },
        { key: "overtimeDate", header: "Date", hideOnMobile: true },
        { key: "overtimeMinutes", header: "Minutes", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/hr/overtime"}
      disableRowClick
    />
  );
}

export function LeaveListPage() {
  return (
    <HrList
      title="Leave"
      description="Leave applications with manager and HR approval."
      resource="leave"
      permission={P.leave}
      createHref="/hr/leave/new"
      createLabel="Apply for leave"
      exportColumns={["applicationNumber", "employeeId", "fromDate", "toDate", "days", "status"]}
      columns={[
        { key: "applicationNumber", header: "APP #" },
        { key: "employeeId", header: "Employee" },
        { key: "fromDate", header: "From", hideOnMobile: true },
        { key: "toDate", header: "To", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/hr/leave"}
      disableRowClick
    />
  );
}

export function LeavePolicyListPage() {
  return (
    <HrList
      title="Leave policies"
      description="Entitlements and accrual configuration."
      resource="leavePolicies"
      permission={P.leave}
      createHref="/hr/leave/policies/new"
      createLabel="New policy"
      exportColumns={["code", "name", "annualEntitlement", "paid", "status"]}
      columns={[
        { key: "code", header: "Code" },
        { key: "name", header: "Name" },
        { key: "annualEntitlement", header: "Days", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/hr/leave/policies"}
      disableRowClick
    />
  );
}

export function CompensationListPage() {
  return (
    <HrList
      title="Salary structures"
      description="Employee compensation components effective by date."
      resource="compensation"
      permission={P.payroll}
      createHref="/hr/salary-structures/new"
      createLabel="New structure"
      exportColumns={["employeeId", "effectiveFrom", "basic", "hra", "currency", "payFrequency"]}
      columns={[
        { key: "employeeId", header: "Employee" },
        { key: "effectiveFrom", header: "From", hideOnMobile: true },
        { key: "basic", header: "Basic", hideOnMobile: true },
        { key: "currency", header: "Currency", hideOnMobile: true },
      ]}
      rowHref={() => "/hr/salary-structures"}
      disableRowClick
    />
  );
}

export function PayrollListPage() {
  return (
    <HrList
      title="Payroll runs"
      description="Payroll periods with validation, calculation, and approval workflow."
      resource="payroll"
      permission={P.payroll}
      createHref="/hr/payroll/new"
      createLabel="New payroll run"
      exportColumns={["payrollNumber", "periodFrom", "periodTo", "status", "departmentId"]}
      columns={[
        { key: "payrollNumber", header: "Run #" },
        { key: "periodFrom", header: "From", hideOnMobile: true },
        { key: "periodTo", header: "To", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/hr/payroll/${row.id}`}
    />
  );
}

export function PayslipListPage() {
  return (
    <HrList
      title="Payslips"
      description="Issued payslips from finalized payroll runs."
      resource="payslips"
      permission={P.payroll}
      exportColumns={["payslipNumber", "employeeCode", "periodFrom", "periodTo", "netPayable", "status"]}
      columns={[
        { key: "payslipNumber", header: "PSL #" },
        { key: "employeeCode", header: "Employee" },
        { key: "periodFrom", header: "From", hideOnMobile: true },
        { key: "netPayable", header: "Net", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/hr/payslips"}
      disableRowClick
    />
  );
}

export function EmployeeRequestListPage() {
  return (
    <HrList
      title="Employee requests"
      description="HR service desk tickets and employee-initiated requests."
      resource="requests"
      permission={P.hr}
      createHref="/hr/requests/new"
      createLabel="New request"
      exportColumns={["requestNumber", "requestType", "employeeId", "status", "createdAt"]}
      columns={[
        { key: "requestNumber", header: "REQ #" },
        { key: "requestType", header: "Type" },
        { key: "employeeId", header: "Employee", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/hr/requests"}
      disableRowClick
    />
  );
}

export function SeparationListPage() {
  return (
    <HrList
      title="Separations"
      description="Resignations and terminations with clearance workflow."
      resource="separations"
      permission={P.separation}
      createHref="/hr/separations/new"
      createLabel="Initiate separation"
      exportColumns={["separationNumber", "employeeId", "separationType", "requestedLastWorkingDay", "status"]}
      columns={[
        { key: "separationNumber", header: "SEP #" },
        { key: "employeeId", header: "Employee" },
        { key: "separationType", header: "Type", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/hr/separations/${row.id}`}
    />
  );
}

export function TrainingCourseListPage() {
  return (
    <HrList
      title="Training courses"
      description="Course catalog for GMP, safety, and role training."
      resource="trainingCourses"
      permission={P.training}
      createHref="/hr/training/courses/new"
      createLabel="New course"
      exportColumns={["code", "title", "category", "mandatory", "status"]}
      columns={[
        { key: "code", header: "Code" },
        { key: "title", header: "Title" },
        { key: "category", header: "Category", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/hr/training"}
      disableRowClick
    />
  );
}

export function TrainingAssignmentListPage() {
  return (
    <HrList
      title="Training assignments"
      description="Assigned courses with due dates and completion status."
      resource="trainingAssignments"
      permission={P.training}
      exportColumns={["employeeId", "courseId", "dueDate", "status"]}
      columns={[
        { key: "employeeId", header: "Employee" },
        { key: "courseId", header: "Course" },
        { key: "dueDate", header: "Due", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
      rowHref={() => "/hr/training"}
      disableRowClick
    />
  );
}

export function TrainingOverviewPage() {
  return (
    <RequirePermission permission={P.training}>
      <div className="space-y-8">
        <PageHeader
          title="Training"
          description="Course catalog, assignments, and completion evidence."
          actions={
            <>
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/hr/training/courses/new">New course</Link>
              </Button>
              <Button asChild className="min-h-11">
                <Link href="/hr/training/assignments/new">Assign training</Link>
              </Button>
            </>
          }
        />
        <TrainingCourseListPage />
        <TrainingAssignmentListPage />
      </div>
    </RequirePermission>
  );
}

export function PerformanceFoundationPage() {
  return (
    <RequirePermission permission={P.employee}>
      <EmptyState
        title="Performance management foundation"
        description="Performance cycles, goals, and review workflows will connect here once the performance API is enabled. No sample data is shown."
      />
    </RequirePermission>
  );
}

export function DisciplinaryFoundationPage() {
  return (
    <RequirePermission permission={P.employee}>
      <EmptyState
        title="Disciplinary records (restricted foundation)"
        description="Disciplinary case management requires elevated HR permissions and will be enabled in a later phase. Use employee requests for interim tracking."
      />
    </RequirePermission>
  );
}

export function HrOrganizationPage() {
  return (
    <RequirePermission permission={P.hr}>
      <div>
        <PageHeader title="Organization" description="Departments and job structure for the workforce." />
        <div className="grid gap-3 sm:max-w-md">
          <Link href="/admin/departments" className="rounded-xl border p-4 hover:bg-muted/40">
            <p className="font-medium">Departments</p>
            <p className="text-sm text-muted-foreground">Manage department master in admin.</p>
          </Link>
          <Link href="/hr/designations" className="rounded-xl border p-4 hover:bg-muted/40">
            <p className="font-medium">Designations</p>
            <p className="text-sm text-muted-foreground">Job titles and grades for employees and requisitions.</p>
          </Link>
        </div>
      </div>
    </RequirePermission>
  );
}

export function HrDepartmentsLinkPage() {
  return (
    <RequirePermission permission={P.hr}>
      <div>
        <PageHeader
          title="Departments"
          description="Department hierarchy is maintained in the admin module."
        />
        <Link href="/admin/departments" className="text-primary underline-offset-4 hover:underline">
          Open department admin →
        </Link>
      </div>
    </RequirePermission>
  );
}

export function EmployeeDetail({ id }: { id: string }) {
  return (
    <DetailShell permission={P.employee} resource="employees" id={id} titleKey="employeeCode" statusOptions={employmentStatusOptions}>
      {({ record, extra, reload }) => (
        <div className="space-y-6">
          <EmployeeTransitionActions id={id} status={String(record.status || "")} onChanged={reload} />
          <RecordGrid
            record={record}
            fields={[
              "fullName",
              "officialEmail",
              "phone",
              "departmentId",
              "designationId",
              "reportingManagerId",
              "employmentType",
              "joiningDate",
              "facilityId",
            ]}
            statusOptions={employmentStatusOptions}
          />
          <RelatedList title="Onboarding tasks" rows={(extra.onboarding as Row[]) || []} columns={["title", "category", "status", "dueDate"]} />
          <RelatedList title="Leave applications" rows={(extra.leave as Row[]) || []} columns={["applicationNumber", "fromDate", "toDate", "status"]} />
          <RelatedList title="Training assignments" rows={(extra.training as Row[]) || []} columns={["courseId", "dueDate", "status"]} />
        </div>
      )}
    </DetailShell>
  );
}

export function RequisitionDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.recruitment}
      resource="requisitions"
      id={id}
      titleKey="requisitionNumber"
      statusOptions={recruitmentStatusOptions}
      workflowResource="requisitions"
      actions={ALL_REQUISITION_ACTIONS}
    >
      {({ record }) => (
        <RecordGrid
          record={record}
          fields={["title", "departmentId", "designationId", "headcount", "requiredQualifications", "targetJoiningDate", "justification"]}
          statusOptions={recruitmentStatusOptions}
        />
      )}
    </DetailShell>
  );
}

export function PayrollDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.payroll}
      resource="payroll"
      id={id}
      titleKey="payrollNumber"
      statusOptions={payrollStatusOptions}
      workflowResource="payroll"
      actions={ALL_PAYROLL_ACTIONS}
    >
      {({ record, extra }) => (
        <div className="space-y-6">
          <RecordGrid record={record} fields={["periodFrom", "periodTo", "departmentId", "facilityId", "notes"]} statusOptions={payrollStatusOptions} />
          <RelatedList title="Payroll entries" rows={(extra.entries as Row[]) || []} columns={["employeeCode", "fullName", "grossEarnings", "netPayable"]} />
        </div>
      )}
    </DetailShell>
  );
}

export function SeparationDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.separation}
      resource="separations"
      id={id}
      titleKey="separationNumber"
      statusOptions={separationStatusOptions}
      workflowResource="separations"
      actions={ALL_SEPARATION_ACTIONS}
    >
      {({ record, extra }) => (
        <div className="space-y-6">
          <RecordGrid
            record={record}
            fields={["employeeId", "separationType", "requestedLastWorkingDay", "noticePeriodDays", "reason", "accessDeactivated"]}
            statusOptions={separationStatusOptions}
          />
          <RelatedList title="Clearance tasks" rows={(extra.clearance as Row[]) || []} columns={["category", "title", "status"]} />
        </div>
      )}
    </DetailShell>
  );
}

export function LeaveDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.leave}
      resource="leave"
      id={id}
      titleKey="applicationNumber"
      statusOptions={leaveStatusOptions}
      workflowResource="leave"
      actions={ALL_LEAVE_ACTIONS}
    >
      {({ record }) => (
        <RecordGrid record={record} fields={["employeeId", "leavePolicyId", "fromDate", "toDate", "days", "reason"]} statusOptions={leaveStatusOptions} />
      )}
    </DetailShell>
  );
}

export function OvertimeDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.attendance}
      resource="overtime"
      id={id}
      titleKey="overtimeNumber"
      statusOptions={overtimeStatusOptions}
      workflowResource="overtime"
      actions={ALL_OVERTIME_ACTIONS}
    >
      {({ record }) => (
        <RecordGrid record={record} fields={["employeeId", "overtimeDate", "overtimeMinutes", "reason", "departmentId"]} statusOptions={overtimeStatusOptions} />
      )}
    </DetailShell>
  );
}

export function OnboardingDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.employee}
      resource="onboarding"
      id={id}
      titleKey="title"
      statusOptions={[
        { label: "Pending", value: "pending" },
        { label: "Completed", value: "completed" },
      ]}
      workflowResource="onboarding"
      actions={[ONBOARDING_ACTIONS.complete]}
    >
      {({ record }) => (
        <RecordGrid record={record} fields={["employeeId", "category", "dueDate", "assignedTo", "documentRef"]} />
      )}
    </DetailShell>
  );
}

export function AttendanceCorrectionDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.attendance}
      resource="attendanceCorrections"
      id={id}
      titleKey="correctionNumber"
      statusOptions={[
        { label: "Submitted", value: "submitted" },
        { label: "Approved", value: "approved" },
        { label: "Rejected", value: "rejected" },
      ]}
      workflowResource="attendanceCorrections"
      actions={[ATTENDANCE_CORRECTION_ACTIONS.approve, ATTENDANCE_CORRECTION_ACTIONS.reject]}
    >
      {({ record }) => (
        <RecordGrid record={record} fields={["attendanceId", "revisedCheckIn", "revisedCheckOut", "revisedStatus", "reason"]} />
      )}
    </DetailShell>
  );
}

export function EmployeeRequestDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.hr}
      resource="requests"
      id={id}
      titleKey="requestNumber"
      statusOptions={[
        { label: "Submitted", value: "submitted" },
        { label: "Assigned", value: "assigned" },
        { label: "Under review", value: "under_review" },
        { label: "Approved", value: "approved" },
        { label: "Closed", value: "closed" },
      ]}
      workflowResource="requests"
      actions={ALL_REQUEST_ACTIONS}
    >
      {({ record }) => <RecordGrid record={record} fields={["requestType", "employeeId", "description"]} />}
    </DetailShell>
  );
}

export function HeadcountReportPage() {
  return <HrReportsPage defaultType="headcount" />;
}

function DetailShell({
  permission,
  resource,
  id,
  titleKey,
  statusOptions,
  workflowResource,
  actions,
  children,
}: {
  permission: Permission;
  resource: string;
  id: string;
  titleKey: string;
  statusOptions?: Array<{ label: string; value: string }>;
  workflowResource?: string;
  actions?: Parameters<typeof HrWorkflowActions>[0]["actions"];
  children?: (ctx: { record: Row; extra: Record<string, unknown>; reload: () => void }) => ReactNode;
}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  function load() {
    void getHr(resource, id)
      .then((result) => {
        setRecord(result.record as Row);
        setExtra(result.extra || {});
        setError(null);
      })
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) {
    return <EmptyState title="Unable to load record" description={error || "Not found."} />;
  }

  const status = String(record.status || "");
  const opts = statusOptions || employmentStatusOptions;
  const displayTitle = String(record[titleKey] || record.fullName || record.title || record.id);

  return (
    <RequirePermission permission={permission}>
      <div>
        <PageHeader title={displayTitle} description="HR record with audited workflow actions." />
        {workflowResource && actions?.length ? (
          <HrWorkflowActions resource={workflowResource} id={id} status={status} statusOptions={opts} actions={actions} onChanged={load} />
        ) : statusOptions ? (
          <div className="mb-6 rounded-xl border bg-card p-4">
            <StatusBadge label={labelFor(opts, status)} tone={workflowTone(status)} />
          </div>
        ) : null}
        {children?.({ record, extra, reload: load })}
      </div>
    </RequirePermission>
  );
}

function RecordGrid({
  record,
  fields,
  statusOptions = employmentStatusOptions,
}: {
  record: Row;
  fields: string[];
  statusOptions?: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <div key={field}>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{field}</p>
          <p className="mt-1 text-sm font-medium break-all">{formatValue(record[field])}</p>
        </div>
      ))}
      {record.status !== undefined ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">status</p>
          <div className="mt-1">
            <StatusBadge label={labelFor(statusOptions, String(record.status || ""))} tone={workflowTone(String(record.status || ""))} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RelatedList({ title, rows, columns }: { title: string; rows: Row[]; columns: string[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No {title.toLowerCase()} linked.</p>;
  return (
    <div className="rounded-xl border">
      <div className="border-b px-4 py-3 text-sm font-medium">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {columns.map((column) => (
                <th key={column} className="px-4 py-2 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)} className="border-b last:border-0">
                {columns.map((column) => (
                  <td key={column} className="px-4 py-2">
                    {formatValue(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
