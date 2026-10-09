"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/hooks/use-confirm";
import { runHrAction } from "@/lib/hr/client";
import { EMPLOYMENT_TRANSITIONS } from "@/lib/hr/status";
import {
  employmentStatusOptions,
  labelFor,
  leaveStatusOptions,
  overtimeStatusOptions,
  payrollStatusOptions,
  recruitmentStatusOptions,
  separationStatusOptions,
  workflowTone,
} from "@/lib/hr/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

const COMMENT_ACTIONS = new Set([
  "reject",
  "cancel",
  "reopen",
  "close",
  "waive_clearance",
  "complete_clearance",
]);

export interface HrWorkflowAction {
  action: string;
  label: string;
  permission: Permission;
  variant?: "default" | "outline" | "destructive";
  requireReason?: boolean;
  payload?: Record<string, unknown>;
}

export function hrAction(
  action: string,
  label: string,
  permission: Permission,
  options: Omit<HrWorkflowAction, "action" | "label" | "permission"> = {}
): HrWorkflowAction {
  return {
    action,
    label,
    permission,
    requireReason: options.requireReason ?? COMMENT_ACTIONS.has(action),
    ...options,
  };
}

export const REQUISITION_ACTIONS = {
  submit_department: hrAction("submit_department", "Submit to department", "hrRecruitment:update" as Permission),
  submit_hr: hrAction("submit_hr", "Submit to HR", "hrRecruitment:update" as Permission),
  approve: hrAction("approve", "Approve requisition", "hrRecruitment:update" as Permission),
  open: hrAction("open", "Open recruitment", "hrRecruitment:update" as Permission, { requireReason: false }),
  start_interviews: hrAction("start_interviews", "Start interviews", "hrRecruitment:update" as Permission, {
    requireReason: false,
  }),
  select: hrAction("select", "Selection stage", "hrRecruitment:update" as Permission, { requireReason: false }),
  offer: hrAction("offer", "Issue offer", "hrRecruitment:update" as Permission),
  accept: hrAction("accept", "Offer accepted", "hrRecruitment:update" as Permission, { requireReason: false }),
  start_onboarding: hrAction("start_onboarding", "Start onboarding", "hrRecruitment:update" as Permission, {
    requireReason: false,
  }),
  reject: hrAction("reject", "Reject", "hrRecruitment:update" as Permission, { variant: "destructive" }),
  cancel: hrAction("cancel", "Cancel", "hrRecruitment:update" as Permission, { variant: "destructive" }),
  reopen: hrAction("reopen", "Reopen draft", "hrRecruitment:update" as Permission),
};

export const LEAVE_ACTIONS = {
  submit_manager: hrAction("submit_manager", "Manager review", "hrLeave:update" as Permission, { requireReason: false }),
  submit_hr: hrAction("submit_hr", "HR review", "hrLeave:update" as Permission, { requireReason: false }),
  approve: hrAction("approve", "Approve leave", "hrLeave:approve" as Permission),
  reject: hrAction("reject", "Reject", "hrLeave:approve" as Permission, { variant: "destructive" }),
  cancel: hrAction("cancel", "Cancel", "hrLeave:update" as Permission, { variant: "destructive" }),
};

export const OVERTIME_ACTIONS = {
  approve: hrAction("approve", "Approve overtime", "hrAttendance:approve" as Permission),
  reject: hrAction("reject", "Reject", "hrAttendance:approve" as Permission, { variant: "destructive" }),
  include_payroll: hrAction("include_payroll", "Include in payroll", "hrAttendance:approve" as Permission, {
    requireReason: false,
  }),
  resubmit: hrAction("resubmit", "Resubmit", "hrAttendance:create" as Permission, { requireReason: false }),
  cancel: hrAction("cancel", "Cancel", "hrAttendance:approve" as Permission, { variant: "destructive" }),
};

export const PAYROLL_ACTIONS = {
  validate: hrAction("validate", "Validate inputs", "hrPayroll:create" as Permission, { requireReason: false }),
  calculate: hrAction("calculate", "Calculate payroll", "hrPayroll:create" as Permission, { requireReason: false }),
  exception_review: hrAction("exception_review", "Exception review", "hrPayroll:create" as Permission),
  hr_review: hrAction("hr_review", "HR review", "hrPayroll:create" as Permission, { requireReason: false }),
  finance_review: hrAction("finance_review", "Finance review", "hrPayroll:approve" as Permission, {
    requireReason: false,
  }),
  approve: hrAction("approve", "Approve payroll", "hrPayroll:approve" as Permission),
  finalize: hrAction("finalize", "Finalize", "hrPayroll:approve" as Permission),
  payment_reference: hrAction("payment_reference", "Record payment ref", "hrPayroll:approve" as Permission, {
    requireReason: false,
  }),
  reconcile: hrAction("reconcile", "Reconcile", "hrPayroll:approve" as Permission, { requireReason: false }),
  reject: hrAction("reject", "Reject", "hrPayroll:approve" as Permission, { variant: "destructive" }),
  cancel: hrAction("cancel", "Cancel run", "hrPayroll:create" as Permission, { variant: "destructive" }),
};

export const SEPARATION_ACTIONS = {
  manager_review: hrAction("manager_review", "Manager review", "hrSeparation:update" as Permission, {
    requireReason: false,
  }),
  hr_review: hrAction("hr_review", "HR review", "hrSeparation:update" as Permission, { requireReason: false }),
  department_clearance: hrAction("department_clearance", "Department clearance", "hrSeparation:update" as Permission),
  asset_clearance: hrAction("asset_clearance", "Asset clearance", "hrSeparation:update" as Permission),
  finance_clearance: hrAction("finance_clearance", "Finance clearance", "hrSeparation:update" as Permission),
  access_deactivation: hrAction("access_deactivation", "Deactivate access", "hrSeparation:update" as Permission),
  final_approval: hrAction("final_approval", "Final approval", "hrSeparation:update" as Permission),
  close: hrAction("close", "Close separation", "hrSeparation:update" as Permission),
  cancel: hrAction("cancel", "Cancel", "hrSeparation:update" as Permission, { variant: "destructive" }),
};

export const REQUEST_ACTIONS = {
  assign: hrAction("assign", "Assign", "hr:update" as Permission, { requireReason: false }),
  review: hrAction("review", "Under review", "hr:update" as Permission, { requireReason: false }),
  await_info: hrAction("await_info", "Awaiting information", "hr:update" as Permission),
  approve: hrAction("approve", "Approve", "hr:update" as Permission),
  reject: hrAction("reject", "Reject", "hr:update" as Permission, { variant: "destructive" }),
  complete: hrAction("complete", "Complete", "hr:update" as Permission, { requireReason: false }),
  close: hrAction("close", "Close", "hr:update" as Permission),
  cancel: hrAction("cancel", "Cancel", "hr:update" as Permission, { variant: "destructive" }),
};

export const ATTENDANCE_CORRECTION_ACTIONS = {
  approve: hrAction("approve", "Approve correction", "hrAttendance:approve" as Permission),
  reject: hrAction("reject", "Reject correction", "hrAttendance:approve" as Permission, { variant: "destructive" }),
};

export const ONBOARDING_ACTIONS = {
  complete: hrAction("complete", "Mark complete", "hrEmployee:update" as Permission, { requireReason: false }),
};

export const STATUTORY_ACTIONS = {
  approve: hrAction("approve", "Approve rule", "hr:update" as Permission),
};

export const ALL_REQUISITION_ACTIONS = Object.values(REQUISITION_ACTIONS);
export const ALL_LEAVE_ACTIONS = Object.values(LEAVE_ACTIONS);
export const ALL_OVERTIME_ACTIONS = Object.values(OVERTIME_ACTIONS);
export const ALL_PAYROLL_ACTIONS = Object.values(PAYROLL_ACTIONS);
export const ALL_SEPARATION_ACTIONS = Object.values(SEPARATION_ACTIONS);
export const ALL_REQUEST_ACTIONS = Object.values(REQUEST_ACTIONS);

export function HrWorkflowActions({
  resource,
  id,
  status,
  statusOptions,
  actions,
  onChanged,
}: {
  resource: string;
  id: string;
  status: string;
  statusOptions: Array<{ label: string; value: string }>;
  actions: HrWorkflowAction[];
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const confirm = useConfirm();

  async function run(item: HrWorkflowAction) {
    const accepted = await confirm({
      title: item.label,
      description: "This HR action is audited and validated on the server.",
      confirmLabel: item.label,
    });
    if (!accepted) return;
    let comment: string | undefined;
    if (item.requireReason) {
      comment = window.prompt("Enter a reason or comment") || "";
      if (!comment.trim()) {
        toast.error("A reason is required");
        return;
      }
    }
    const payload: Record<string, unknown> = { ...item.payload, comment, reason: comment };
    if (item.action === "payment_reference") {
      const paymentReference = window.prompt("Payment reference (required)") || "";
      if (!paymentReference.trim()) {
        toast.error("Payment reference is required");
        return;
      }
      payload.paymentReference = paymentReference;
    }
    try {
      await runHrAction(resource, id, item.action, payload);
      toast.success("Status updated");
      onChanged();
    } catch (error) {
      toast.error("Unable to complete action", publicMasterError(error));
    }
  }

  return (
    <div className="mb-6 rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Status</span>
        <StatusBadge label={labelFor(statusOptions, status)} tone={workflowTone(status)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((item) =>
          can(item.permission) ? (
            <Button
              key={`${item.action}-${item.label}`}
              size="sm"
              className="min-h-11"
              variant={item.variant || "outline"}
              onClick={() => void run(item)}
            >
              {item.label}
            </Button>
          ) : null
        )}
      </div>
    </div>
  );
}

export function EmployeeTransitionActions({
  id,
  status,
  onChanged,
}: {
  id: string;
  status: string;
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const confirm = useConfirm();
  const nextStatuses = EMPLOYMENT_TRANSITIONS[status] || [];

  async function transition(toStatus: string) {
    const accepted = await confirm({
      title: "Change employment status",
      description: `Transition to ${toStatus.replace(/_/g, " ")}.`,
      confirmLabel: "Transition",
    });
    if (!accepted) return;
    const reason = window.prompt("Reason for status change (required)") || "";
    if (!reason.trim()) {
      toast.error("A reason is required");
      return;
    }
    try {
      await runHrAction("employees", id, "transition", { toStatus, comment: reason, reason });
      toast.success("Employment status updated");
      onChanged();
    } catch (error) {
      toast.error("Unable to transition", publicMasterError(error));
    }
  }

  if (!nextStatuses.length) return null;

  return (
    <div className="mb-6 rounded-xl border bg-card p-4">
      <p className="mb-3 text-sm font-medium">Employment status transitions</p>
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((toStatus) =>
          can("hrEmployee:update" as Permission) ? (
            <Button key={toStatus} size="sm" className="min-h-11" variant="outline" onClick={() => void transition(toStatus)}>
              → {labelFor(employmentStatusOptions, toStatus)}
            </Button>
          ) : null
        )}
      </div>
    </div>
  );
}

export {
  employmentStatusOptions,
  leaveStatusOptions,
  overtimeStatusOptions,
  payrollStatusOptions,
  recruitmentStatusOptions,
  separationStatusOptions,
};
