"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MasterPick } from "@/components/warehouse/master-pick";
import { createHr, listHr } from "@/lib/hr/client";
import {
  attendanceStatusOptions,
  employmentTypeOptions,
  requestTypeOptions,
} from "@/lib/hr/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function FormShell({
  permission,
  title,
  description,
  onSubmit,
  children,
}: {
  permission: Permission;
  title: string;
  description: string;
  onSubmit: () => Promise<void>;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <RequirePermission permission={permission}>
      <div>
        <PageHeader title={title} description={description} />
        <form
          className="max-w-3xl space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void onSubmit()
              .catch((error) => toast.error("Unable to save", publicMasterError(error)))
              .finally(() => setBusy(false));
          }}
        >
          {children}
          <Button type="submit" className="min-h-11" disabled={busy}>
            Save
          </Button>
        </form>
      </div>
    </RequirePermission>
  );
}

export function EmployeeForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    officialEmail: "",
    phone: "",
    departmentId: "",
    designationId: "",
    reportingManagerId: "",
    facilityId: "",
    employmentType: "permanent",
    joiningDate: new Date().toISOString().slice(0, 10),
    shiftId: "",
    notes: "",
  });

  return (
    <FormShell
      permission="hrEmployee:create"
      title="New employee"
      description="Register an employee profile with org links and joining date."
      onSubmit={async () => {
        const result = await createHr("employees", {
          fullName: form.fullName,
          officialEmail: form.officialEmail || undefined,
          phone: form.phone || undefined,
          departmentId: form.departmentId || undefined,
          designationId: form.designationId || undefined,
          reportingManagerId: form.reportingManagerId || undefined,
          facilityId: form.facilityId || undefined,
          employmentType: form.employmentType,
          joiningDate: form.joiningDate,
          shiftId: form.shiftId || undefined,
          notes: form.notes || undefined,
        });
        toast.success("Employee created");
        router.push(`/hr/employees/${result.id}`);
      }}
    >
      <Field label="Full name">
        <Input className="min-h-11" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Official email">
          <Input className="min-h-11" type="email" value={form.officialEmail} onChange={(e) => setForm({ ...form, officialEmail: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input className="min-h-11" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Department ID">
          <Input className="min-h-11" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} />
        </Field>
        <Field label="Designation ID">
          <Input className="min-h-11" value={form.designationId} onChange={(e) => setForm({ ...form, designationId: e.target.value })} />
        </Field>
        <Field label="Reporting manager ID">
          <Input className="min-h-11" value={form.reportingManagerId} onChange={(e) => setForm({ ...form, reportingManagerId: e.target.value })} />
        </Field>
        <Field label="Facility ID">
          <Input className="min-h-11" value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })} />
        </Field>
        <Field label="Employment type">
          <Select value={form.employmentType} onValueChange={(value) => setForm({ ...form, employmentType: value })}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {employmentTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Joining date">
          <Input className="min-h-11" type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} required />
        </Field>
        <Field label="Default shift ID">
          <Input className="min-h-11" value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function DesignationForm() {
  const router = useRouter();
  const [form, setForm] = useState({ code: "", name: "", departmentId: "", grade: "", description: "" });

  return (
    <FormShell
      permission="hr:create"
      title="New designation"
      description="Job titles and grades used on employee profiles and requisitions."
      onSubmit={async () => {
        await createHr("designations", {
          code: form.code,
          name: form.name,
          departmentId: form.departmentId || undefined,
          grade: form.grade || undefined,
          description: form.description || undefined,
        });
        toast.success("Designation saved");
        router.push("/hr/designations");
      }}
    >
      <Field label="Code">
        <Input className="min-h-11" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
      </Field>
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Department ID">
        <Input className="min-h-11" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} />
      </Field>
      <Field label="Grade">
        <Input className="min-h-11" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
      </Field>
      <Field label="Description">
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function RequisitionForm() {
  const router = useRouter();
  const [designations, setDesignations] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [form, setForm] = useState({
    title: "",
    departmentId: "",
    designationId: "",
    headcount: "1",
    requiredQualifications: "",
    requiredExperience: "",
    justification: "",
    targetJoiningDate: "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listHr("designations", { pageSize: 100 })
        .then((result) => setDesignations(result.rows))
        .catch(() => setDesignations([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <FormShell
      permission="hrRecruitment:create"
      title="New job requisition"
      description="Headcount request with department approval workflow."
      onSubmit={async () => {
        if (!form.departmentId) throw new Error("Select a department.");
        const result = await createHr("requisitions", {
          title: form.title,
          departmentId: form.departmentId,
          designationId: form.designationId || undefined,
          headcount: Number(form.headcount),
          requiredQualifications: form.requiredQualifications || undefined,
          requiredExperience: form.requiredExperience || undefined,
          justification: form.justification || undefined,
          targetJoiningDate: form.targetJoiningDate || undefined,
        });
        toast.success("Requisition created");
        router.push(`/hr/recruitment/${result.id}`);
      }}
    >
      <Field label="Title">
        <Input className="min-h-11" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <MasterPick
          entity="departments"
          label="Department"
          value={form.departmentId}
          onChange={(departmentId) => setForm({ ...form, departmentId })}
          required
        />
        <Field label="Designation">
          <Select value={form.designationId || undefined} onValueChange={(designationId) => setForm({ ...form, designationId })}>
            <SelectTrigger className="min-h-11 w-full">
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              {designations.map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {String(row.code && row.name ? `${row.code} — ${row.name}` : row.name || row.code || row.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Headcount">
          <Input className="min-h-11" type="number" min={1} value={form.headcount} onChange={(e) => setForm({ ...form, headcount: e.target.value })} />
        </Field>
        <Field label="Target joining date">
          <Input className="min-h-11" type="date" value={form.targetJoiningDate} onChange={(e) => setForm({ ...form, targetJoiningDate: e.target.value })} />
        </Field>
      </div>
      <Field label="Required qualifications">
        <Textarea value={form.requiredQualifications} onChange={(e) => setForm({ ...form, requiredQualifications: e.target.value })} />
      </Field>
      <Field label="Required experience">
        <Input className="min-h-11" value={form.requiredExperience} onChange={(e) => setForm({ ...form, requiredExperience: e.target.value })} />
      </Field>
      <Field label="Justification">
        <Textarea value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function CandidateForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    requisitionId: "",
    fullName: "",
    email: "",
    phone: "",
    experienceYears: "",
    qualifications: "",
    interviewNotes: "",
  });

  return (
    <FormShell
      permission="hrRecruitment:create"
      title="New candidate"
      description="Capture applicant details against an open requisition."
      onSubmit={async () => {
        await createHr("candidates", {
          requisitionId: form.requisitionId,
          fullName: form.fullName,
          email: form.email || undefined,
          phone: form.phone || undefined,
          experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
          qualifications: form.qualifications || undefined,
          interviewNotes: form.interviewNotes || undefined,
        });
        toast.success("Candidate saved");
        router.push("/hr/candidates");
      }}
    >
      <Field label="Requisition ID">
        <Input className="min-h-11" value={form.requisitionId} onChange={(e) => setForm({ ...form, requisitionId: e.target.value })} required />
      </Field>
      <Field label="Full name">
        <Input className="min-h-11" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email">
          <Input className="min-h-11" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input className="min-h-11" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Experience (years)">
          <Input className="min-h-11" type="number" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} />
        </Field>
      </div>
      <Field label="Qualifications">
        <Textarea value={form.qualifications} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} />
      </Field>
      <Field label="Interview notes">
        <Textarea value={form.interviewNotes} onChange={(e) => setForm({ ...form, interviewNotes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function OnboardingTaskForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    employeeId: "",
    title: "",
    category: "other",
    dueDate: "",
    assignedTo: "",
    documentRef: "",
  });

  return (
    <FormShell
      permission="hrEmployee:update"
      title="New onboarding task"
      description="Track documents, training, access, and induction checkpoints."
      onSubmit={async () => {
        await createHr("onboarding", {
          employeeId: form.employeeId,
          title: form.title,
          category: form.category,
          dueDate: form.dueDate || undefined,
          assignedTo: form.assignedTo || undefined,
          documentRef: form.documentRef || undefined,
        });
        toast.success("Onboarding task created");
        router.push("/hr/onboarding");
      }}
    >
      <Field label="Employee ID">
        <Input className="min-h-11" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required />
      </Field>
      <Field label="Title">
        <Input className="min-h-11" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      </Field>
      <Field label="Category">
        <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["documents", "training", "access", "assets", "induction", "probation", "other"].map((value) => (
              <SelectItem key={value} value={value}>
                {value.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Due date">
          <Input className="min-h-11" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </Field>
        <Field label="Assigned to (user ID)">
          <Input className="min-h-11" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} />
        </Field>
      </div>
      <Field label="Document reference">
        <Input className="min-h-11" value={form.documentRef} onChange={(e) => setForm({ ...form, documentRef: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function AttendanceForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    employeeId: "",
    attendanceDate: new Date().toISOString().slice(0, 10),
    shiftId: "",
    checkIn: "",
    checkOut: "",
    breakMinutes: "0",
    status: "present",
    notes: "",
  });

  return (
    <FormShell
      permission="hrAttendance:create"
      title="Record attendance"
      description="Manual attendance with working hours and late/overtime calculation."
      onSubmit={async () => {
        await createHr("attendance", {
          employeeId: form.employeeId,
          attendanceDate: form.attendanceDate,
          shiftId: form.shiftId || undefined,
          checkIn: form.checkIn || undefined,
          checkOut: form.checkOut || undefined,
          breakMinutes: form.breakMinutes ? Number(form.breakMinutes) : undefined,
          status: form.status,
          notes: form.notes || undefined,
        });
        toast.success("Attendance recorded");
        router.push("/hr/attendance");
      }}
    >
      <Field label="Employee ID">
        <Input className="min-h-11" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date">
          <Input className="min-h-11" type="date" value={form.attendanceDate} onChange={(e) => setForm({ ...form, attendanceDate: e.target.value })} required />
        </Field>
        <Field label="Shift ID">
          <Input className="min-h-11" value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })} />
        </Field>
        <Field label="Check in (HH:MM)">
          <Input className="min-h-11" placeholder="09:00" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
        </Field>
        <Field label="Check out (HH:MM)">
          <Input className="min-h-11" placeholder="18:00" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
        </Field>
        <Field label="Break minutes">
          <Input className="min-h-11" type="number" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })} />
        </Field>
        <Field label="Status">
          <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {attendanceStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function ShiftForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    code: "",
    name: "",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: "60",
    overnight: "false",
    departmentId: "",
  });

  return (
    <FormShell
      permission="hrAttendance:create"
      title="New shift"
      description="Shift definitions for attendance and roster planning."
      onSubmit={async () => {
        await createHr("shifts", {
          code: form.code,
          name: form.name,
          startTime: form.startTime,
          endTime: form.endTime,
          breakMinutes: Number(form.breakMinutes),
          overnight: form.overnight === "true",
          departmentId: form.departmentId || undefined,
        });
        toast.success("Shift saved");
        router.push("/hr/shifts");
      }}
    >
      <Field label="Code">
        <Input className="min-h-11" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
      </Field>
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Start time">
          <Input className="min-h-11" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
        </Field>
        <Field label="End time">
          <Input className="min-h-11" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
        </Field>
        <Field label="Break minutes">
          <Input className="min-h-11" type="number" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })} />
        </Field>
        <Field label="Department ID">
          <Input className="min-h-11" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} />
        </Field>
      </div>
      <ToggleField label="Overnight shift" value={form.overnight} onChange={(value) => setForm({ ...form, overnight: value })} />
    </FormShell>
  );
}

export function ShiftAssignmentForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    employeeId: "",
    shiftId: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: "",
  });

  return (
    <FormShell
      permission="hrAttendance:create"
      title="Assign shift"
      description="Roster assignment for an employee over a date range."
      onSubmit={async () => {
        await createHr("shiftAssignments", {
          employeeId: form.employeeId,
          shiftId: form.shiftId,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || undefined,
        });
        toast.success("Shift assigned");
        router.push("/hr/rosters");
      }}
    >
      <Field label="Employee ID">
        <Input className="min-h-11" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required />
      </Field>
      <Field label="Shift ID">
        <Input className="min-h-11" value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Effective from">
          <Input className="min-h-11" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required />
        </Field>
        <Field label="Effective to">
          <Input className="min-h-11" type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
        </Field>
      </div>
    </FormShell>
  );
}

export function LeavePolicyForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    code: "",
    name: "",
    annualEntitlement: "12",
    accrualPerMonth: "",
    carryForwardMax: "",
    requiresDocument: "false",
    paid: "true",
  });

  return (
    <FormShell
      permission="hrLeave:create"
      title="New leave policy"
      description="Entitlements and accrual rules for leave applications."
      onSubmit={async () => {
        await createHr("leavePolicies", {
          code: form.code,
          name: form.name,
          annualEntitlement: Number(form.annualEntitlement),
          accrualPerMonth: form.accrualPerMonth ? Number(form.accrualPerMonth) : undefined,
          carryForwardMax: form.carryForwardMax ? Number(form.carryForwardMax) : undefined,
          requiresDocument: form.requiresDocument === "true",
          paid: form.paid === "true",
        });
        toast.success("Leave policy saved");
        router.push("/hr/leave/policies");
      }}
    >
      <Field label="Code">
        <Input className="min-h-11" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
      </Field>
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Annual entitlement (days)">
          <Input className="min-h-11" type="number" value={form.annualEntitlement} onChange={(e) => setForm({ ...form, annualEntitlement: e.target.value })} />
        </Field>
        <Field label="Accrual per month">
          <Input className="min-h-11" type="number" value={form.accrualPerMonth} onChange={(e) => setForm({ ...form, accrualPerMonth: e.target.value })} />
        </Field>
        <Field label="Carry forward max">
          <Input className="min-h-11" type="number" value={form.carryForwardMax} onChange={(e) => setForm({ ...form, carryForwardMax: e.target.value })} />
        </Field>
      </div>
      <ToggleField label="Requires document" value={form.requiresDocument} onChange={(value) => setForm({ ...form, requiresDocument: value })} />
      <ToggleField label="Paid leave" value={form.paid} onChange={(value) => setForm({ ...form, paid: value })} />
    </FormShell>
  );
}

export function LeaveApplicationForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    employeeId: "",
    leavePolicyId: "",
    fromDate: "",
    toDate: "",
    reason: "",
    documentRef: "",
  });

  return (
    <FormShell
      permission="hrLeave:create"
      title="Leave application"
      description="Submit leave for manager and HR approval."
      onSubmit={async () => {
        await createHr("leave", {
          employeeId: form.employeeId,
          leavePolicyId: form.leavePolicyId,
          fromDate: form.fromDate,
          toDate: form.toDate,
          reason: form.reason,
          documentRef: form.documentRef || undefined,
        });
        toast.success("Leave submitted");
        router.push("/hr/leave");
      }}
    >
      <Field label="Employee ID">
        <Input className="min-h-11" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required />
      </Field>
      <Field label="Leave policy ID">
        <Input className="min-h-11" value={form.leavePolicyId} onChange={(e) => setForm({ ...form, leavePolicyId: e.target.value })} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From date">
          <Input className="min-h-11" type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} required />
        </Field>
        <Field label="To date">
          <Input className="min-h-11" type="date" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} required />
        </Field>
      </div>
      <Field label="Reason">
        <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
      </Field>
      <Field label="Document reference">
        <Input className="min-h-11" value={form.documentRef} onChange={(e) => setForm({ ...form, documentRef: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function OvertimeForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    employeeId: "",
    overtimeDate: new Date().toISOString().slice(0, 10),
    overtimeMinutes: "60",
    reason: "",
    shiftId: "",
    departmentId: "",
  });

  return (
    <FormShell
      permission="hrAttendance:create"
      title="Overtime request"
      description="Overtime minutes for approval and payroll inclusion."
      onSubmit={async () => {
        await createHr("overtime", {
          employeeId: form.employeeId,
          overtimeDate: form.overtimeDate,
          overtimeMinutes: Number(form.overtimeMinutes),
          reason: form.reason,
          shiftId: form.shiftId || undefined,
          departmentId: form.departmentId || undefined,
        });
        toast.success("Overtime submitted");
        router.push("/hr/overtime");
      }}
    >
      <Field label="Employee ID">
        <Input className="min-h-11" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date">
          <Input className="min-h-11" type="date" value={form.overtimeDate} onChange={(e) => setForm({ ...form, overtimeDate: e.target.value })} required />
        </Field>
        <Field label="Overtime minutes">
          <Input className="min-h-11" type="number" min={1} value={form.overtimeMinutes} onChange={(e) => setForm({ ...form, overtimeMinutes: e.target.value })} required />
        </Field>
        <Field label="Shift ID">
          <Input className="min-h-11" value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })} />
        </Field>
        <Field label="Department ID">
          <Input className="min-h-11" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} />
        </Field>
      </div>
      <Field label="Reason">
        <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
      </Field>
    </FormShell>
  );
}

export function CompensationForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    employeeId: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    basic: "",
    hra: "",
    otherAllowances: "",
    currency: "INR",
    overtimeEligible: "false",
    payFrequency: "monthly",
    notes: "",
  });

  return (
    <FormShell
      permission="hrPayroll:create"
      title="Salary structure"
      description="Compensation components effective from a date."
      onSubmit={async () => {
        await createHr("compensation", {
          employeeId: form.employeeId,
          effectiveFrom: form.effectiveFrom,
          basic: form.basic ? Number(form.basic) : undefined,
          hra: form.hra ? Number(form.hra) : undefined,
          otherAllowances: form.otherAllowances ? Number(form.otherAllowances) : undefined,
          currency: form.currency,
          overtimeEligible: form.overtimeEligible === "true",
          payFrequency: form.payFrequency,
          notes: form.notes || undefined,
        });
        toast.success("Compensation saved");
        router.push("/hr/salary-structures");
      }}
    >
      <Field label="Employee ID">
        <Input className="min-h-11" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required />
      </Field>
      <Field label="Effective from">
        <Input className="min-h-11" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Basic">
          <Input className="min-h-11" type="number" value={form.basic} onChange={(e) => setForm({ ...form, basic: e.target.value })} />
        </Field>
        <Field label="HRA">
          <Input className="min-h-11" type="number" value={form.hra} onChange={(e) => setForm({ ...form, hra: e.target.value })} />
        </Field>
        <Field label="Other allowances">
          <Input className="min-h-11" type="number" value={form.otherAllowances} onChange={(e) => setForm({ ...form, otherAllowances: e.target.value })} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Currency">
          <Input className="min-h-11" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        </Field>
        <Field label="Pay frequency">
          <Select value={form.payFrequency} onValueChange={(value) => setForm({ ...form, payFrequency: value })}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["monthly", "weekly", "biweekly"].map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <ToggleField label="Overtime eligible" value={form.overtimeEligible} onChange={(value) => setForm({ ...form, overtimeEligible: value })} />
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function PayrollRunForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    periodFrom: "",
    periodTo: "",
    departmentId: "",
    facilityId: "",
    notes: "",
  });

  return (
    <FormShell
      permission="hrPayroll:create"
      title="New payroll run"
      description="Open a payroll period for validation, calculation, and approvals."
      onSubmit={async () => {
        const result = await createHr("payroll", {
          periodFrom: form.periodFrom,
          periodTo: form.periodTo,
          departmentId: form.departmentId || undefined,
          facilityId: form.facilityId || undefined,
          notes: form.notes || undefined,
        });
        toast.success("Payroll run created");
        router.push(`/hr/payroll/${result.id}`);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Period from">
          <Input className="min-h-11" type="date" value={form.periodFrom} onChange={(e) => setForm({ ...form, periodFrom: e.target.value })} required />
        </Field>
        <Field label="Period to">
          <Input className="min-h-11" type="date" value={form.periodTo} onChange={(e) => setForm({ ...form, periodTo: e.target.value })} required />
        </Field>
        <Field label="Department ID">
          <Input className="min-h-11" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} />
        </Field>
        <Field label="Facility ID">
          <Input className="min-h-11" value={form.facilityId} onChange={(e) => setForm({ ...form, facilityId: e.target.value })} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function StatutoryRuleForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: "",
    pfEmployeeRate: "0.12",
    pfEmployerRate: "0.12",
    esiEmployeeRate: "0.0075",
    esiEmployerRate: "0.0325",
    professionalTax: "",
    notes: "",
  });

  return (
    <FormShell
      permission="hr:update"
      title="Statutory rule version"
      description="PF, ESI, and professional tax parameters for payroll calculation."
      onSubmit={async () => {
        await createHr("statutoryRules", {
          name: form.name,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || undefined,
          pfEmployeeRate: Number(form.pfEmployeeRate),
          pfEmployerRate: Number(form.pfEmployerRate),
          esiEmployeeRate: Number(form.esiEmployeeRate),
          esiEmployerRate: Number(form.esiEmployerRate),
          professionalTax: form.professionalTax ? Number(form.professionalTax) : undefined,
          notes: form.notes || undefined,
        });
        toast.success("Statutory rule saved");
        router.push("/hr/settings");
      }}
    >
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Effective from">
          <Input className="min-h-11" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required />
        </Field>
        <Field label="Effective to">
          <Input className="min-h-11" type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="PF employee rate">
          <Input className="min-h-11" type="number" step="0.001" value={form.pfEmployeeRate} onChange={(e) => setForm({ ...form, pfEmployeeRate: e.target.value })} />
        </Field>
        <Field label="PF employer rate">
          <Input className="min-h-11" type="number" step="0.001" value={form.pfEmployerRate} onChange={(e) => setForm({ ...form, pfEmployerRate: e.target.value })} />
        </Field>
        <Field label="ESI employee rate">
          <Input className="min-h-11" type="number" step="0.0001" value={form.esiEmployeeRate} onChange={(e) => setForm({ ...form, esiEmployeeRate: e.target.value })} />
        </Field>
        <Field label="ESI employer rate">
          <Input className="min-h-11" type="number" step="0.0001" value={form.esiEmployerRate} onChange={(e) => setForm({ ...form, esiEmployerRate: e.target.value })} />
        </Field>
        <Field label="Professional tax (flat)">
          <Input className="min-h-11" type="number" value={form.professionalTax} onChange={(e) => setForm({ ...form, professionalTax: e.target.value })} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function EmployeeRequestForm() {
  const router = useRouter();
  const [form, setForm] = useState({ requestType: "general", description: "", employeeId: "" });

  return (
    <FormShell
      permission="hr:create"
      title="Employee request"
      description="HR service desk requests from employees or HR staff."
      onSubmit={async () => {
        await createHr("requests", {
          requestType: form.requestType,
          description: form.description,
          employeeId: form.employeeId || undefined,
        });
        toast.success("Request submitted");
        router.push("/hr/requests");
      }}
    >
      <Field label="Request type">
        <Select value={form.requestType} onValueChange={(value) => setForm({ ...form, requestType: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {requestTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Employee ID (optional)">
        <Input className="min-h-11" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} />
      </Field>
      <Field label="Description">
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
      </Field>
    </FormShell>
  );
}

export function SeparationForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    employeeId: "",
    separationType: "resignation",
    requestedLastWorkingDay: "",
    reason: "",
    noticePeriodDays: "",
  });

  return (
    <FormShell
      permission="hrSeparation:create"
      title="Initiate separation"
      description="Resignation or termination with clearance workflow."
      onSubmit={async () => {
        const result = await createHr("separations", {
          employeeId: form.employeeId,
          separationType: form.separationType,
          requestedLastWorkingDay: form.requestedLastWorkingDay,
          reason: form.reason,
          noticePeriodDays: form.noticePeriodDays ? Number(form.noticePeriodDays) : undefined,
        });
        toast.success("Separation initiated");
        router.push(`/hr/separations/${result.id}`);
      }}
    >
      <Field label="Employee ID">
        <Input className="min-h-11" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required />
      </Field>
      <Field label="Separation type">
        <Select value={form.separationType} onValueChange={(value) => setForm({ ...form, separationType: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["resignation", "termination", "end_of_contract", "retirement", "other"].map((value) => (
              <SelectItem key={value} value={value}>
                {value.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Requested last working day">
          <Input className="min-h-11" type="date" value={form.requestedLastWorkingDay} onChange={(e) => setForm({ ...form, requestedLastWorkingDay: e.target.value })} required />
        </Field>
        <Field label="Notice period (days)">
          <Input className="min-h-11" type="number" value={form.noticePeriodDays} onChange={(e) => setForm({ ...form, noticePeriodDays: e.target.value })} />
        </Field>
      </div>
      <Field label="Reason">
        <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
      </Field>
    </FormShell>
  );
}

export function TrainingCourseForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    code: "",
    title: "",
    category: "other",
    mandatory: "false",
    validityDays: "",
    documentRef: "",
  });

  return (
    <FormShell
      permission="training:create"
      title="New training course"
      description="GMP/GDP and role-based courses for assignment and completion tracking."
      onSubmit={async () => {
        await createHr("trainingCourses", {
          code: form.code,
          title: form.title,
          category: form.category,
          mandatory: form.mandatory === "true",
          validityDays: form.validityDays ? Number(form.validityDays) : undefined,
          documentRef: form.documentRef || undefined,
        });
        toast.success("Course saved");
        router.push("/hr/training");
      }}
    >
      <Field label="Code">
        <Input className="min-h-11" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
      </Field>
      <Field label="Title">
        <Input className="min-h-11" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      </Field>
      <Field label="Category">
        <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["gmp", "gdp", "sop", "safety", "role", "induction", "other"].map((value) => (
              <SelectItem key={value} value={value}>
                {value.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Validity (days)">
        <Input className="min-h-11" type="number" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: e.target.value })} />
      </Field>
      <ToggleField label="Mandatory" value={form.mandatory} onChange={(value) => setForm({ ...form, mandatory: value })} />
      <Field label="Document reference">
        <Input className="min-h-11" value={form.documentRef} onChange={(e) => setForm({ ...form, documentRef: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function TrainingAssignmentForm() {
  const router = useRouter();
  const [form, setForm] = useState({ employeeId: "", courseId: "", dueDate: "", departmentId: "", notes: "" });

  return (
    <FormShell
      permission="training:create"
      title="Assign training"
      description="Assign a course to an employee with optional due date."
      onSubmit={async () => {
        await createHr("trainingAssignments", {
          employeeId: form.employeeId,
          courseId: form.courseId,
          dueDate: form.dueDate || undefined,
          departmentId: form.departmentId || undefined,
          notes: form.notes || undefined,
        });
        toast.success("Training assigned");
        router.push("/hr/training");
      }}
    >
      <Field label="Employee ID">
        <Input className="min-h-11" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required />
      </Field>
      <Field label="Course ID">
        <Input className="min-h-11" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} required />
      </Field>
      <Field label="Due date">
        <Input className="min-h-11" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
      </Field>
      <Field label="Department ID">
        <Input className="min-h-11" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function TrainingCompletionForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    assignmentId: "",
    completedAt: new Date().toISOString().slice(0, 10),
    score: "",
    certificateRef: "",
    evidenceRef: "",
    notes: "",
  });

  return (
    <FormShell
      permission="training:approve"
      title="Record training completion"
      description="Completion with evidence reference for audit."
      onSubmit={async () => {
        await createHr("trainingCompletions", {
          assignmentId: form.assignmentId,
          completedAt: form.completedAt,
          score: form.score ? Number(form.score) : undefined,
          certificateRef: form.certificateRef || undefined,
          evidenceRef: form.evidenceRef,
          notes: form.notes || undefined,
        });
        toast.success("Completion recorded");
        router.push("/hr/training");
      }}
    >
      <Field label="Assignment ID">
        <Input className="min-h-11" value={form.assignmentId} onChange={(e) => setForm({ ...form, assignmentId: e.target.value })} required />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Completed at">
          <Input className="min-h-11" type="date" value={form.completedAt} onChange={(e) => setForm({ ...form, completedAt: e.target.value })} required />
        </Field>
        <Field label="Score (0–100)">
          <Input className="min-h-11" type="number" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
        </Field>
      </div>
      <Field label="Evidence reference">
        <Input className="min-h-11" value={form.evidenceRef} onChange={(e) => setForm({ ...form, evidenceRef: e.target.value })} required />
      </Field>
      <Field label="Certificate reference">
        <Input className="min-h-11" value={form.certificateRef} onChange={(e) => setForm({ ...form, certificateRef: e.target.value })} />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function HrSettingsForm() {
  const [form, setForm] = useState({
    timezone: "Asia/Kolkata",
    currency: "INR",
    lateGraceMinutes: "15",
    requireManagerLeaveApproval: "true",
    requireHrLeaveApproval: "false",
    overtimeEligibleByDefault: "false",
    payrollRequiresFinanceApproval: "true",
    deactivateAccessOnSeparation: "true",
    statutoryDisclaimer: "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listHr("settings", { pageSize: 1 })
        .then((result) => {
          const row = result.rows[0];
          if (!row) return;
          setForm({
            timezone: String(row.timezone || "Asia/Kolkata"),
            currency: String(row.currency || "INR"),
            lateGraceMinutes: String(row.lateGraceMinutes ?? 15),
            requireManagerLeaveApproval: String(row.requireManagerLeaveApproval ?? true),
            requireHrLeaveApproval: String(row.requireHrLeaveApproval ?? false),
            overtimeEligibleByDefault: String(row.overtimeEligibleByDefault ?? false),
            payrollRequiresFinanceApproval: String(row.payrollRequiresFinanceApproval ?? true),
            deactivateAccessOnSeparation: String(row.deactivateAccessOnSeparation ?? true),
            statutoryDisclaimer: String(row.statutoryDisclaimer || ""),
          });
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function save() {
    try {
      await createHr("settings", {
        timezone: form.timezone,
        currency: form.currency,
        lateGraceMinutes: Number(form.lateGraceMinutes),
        requireManagerLeaveApproval: form.requireManagerLeaveApproval === "true",
        requireHrLeaveApproval: form.requireHrLeaveApproval === "true",
        overtimeEligibleByDefault: form.overtimeEligibleByDefault === "true",
        payrollRequiresFinanceApproval: form.payrollRequiresFinanceApproval === "true",
        deactivateAccessOnSeparation: form.deactivateAccessOnSeparation === "true",
        statutoryDisclaimer: form.statutoryDisclaimer || undefined,
      });
      toast.success("HR settings saved");
    } catch (error) {
      toast.error("Unable to save settings", publicMasterError(error));
    }
  }

  return (
    <RequirePermission permission="hr:update">
      <div>
        <PageHeader title="HR settings" description="Timezone, leave rules, overtime defaults, and payroll controls." />
        <div className="mb-6 grid max-w-2xl gap-3">
          <Field label="Timezone">
            <Input className="min-h-11" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </Field>
          <Field label="Currency">
            <Input className="min-h-11" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </Field>
          <Field label="Late grace (minutes)">
            <Input className="min-h-11" type="number" value={form.lateGraceMinutes} onChange={(e) => setForm({ ...form, lateGraceMinutes: e.target.value })} />
          </Field>
          <ToggleField
            label="Require manager leave approval"
            value={form.requireManagerLeaveApproval}
            onChange={(value) => setForm({ ...form, requireManagerLeaveApproval: value })}
          />
          <ToggleField
            label="Require HR leave approval"
            value={form.requireHrLeaveApproval}
            onChange={(value) => setForm({ ...form, requireHrLeaveApproval: value })}
          />
          <ToggleField
            label="Overtime eligible by default"
            value={form.overtimeEligibleByDefault}
            onChange={(value) => setForm({ ...form, overtimeEligibleByDefault: value })}
          />
          <ToggleField
            label="Payroll requires finance approval"
            value={form.payrollRequiresFinanceApproval}
            onChange={(value) => setForm({ ...form, payrollRequiresFinanceApproval: value })}
          />
          <ToggleField
            label="Deactivate access on separation"
            value={form.deactivateAccessOnSeparation}
            onChange={(value) => setForm({ ...form, deactivateAccessOnSeparation: value })}
          />
          <Field label="Statutory disclaimer">
            <Textarea value={form.statutoryDisclaimer} onChange={(e) => setForm({ ...form, statutoryDisclaimer: e.target.value })} />
          </Field>
        </div>
        <Button className="min-h-11" onClick={() => void save()}>
          Save settings
        </Button>
      </div>
    </RequirePermission>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-h-11 w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
