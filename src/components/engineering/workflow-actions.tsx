"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/hooks/use-confirm";
import { runEngineeringAction } from "@/lib/engineering/client";
import { EQUIPMENT_TRANSITIONS } from "@/lib/engineering/status";
import { equipmentStatusOptions, labelFor, workflowTone } from "@/lib/engineering/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

const COMMENT_ACTIONS = new Set([
  "reject",
  "cancel",
  "close",
  "reopen",
  "fail",
  "oot",
  "acknowledge",
  "qa_assessment",
]);

export interface EngineeringWorkflowAction {
  action: string;
  label: string;
  permission: Permission;
  variant?: "default" | "outline" | "destructive";
  requireReason?: boolean;
  payload?: Record<string, unknown>;
}

export function engineeringAction(
  action: string,
  label: string,
  permission: Permission,
  options: Omit<EngineeringWorkflowAction, "action" | "label" | "permission"> = {}
): EngineeringWorkflowAction {
  return {
    action,
    label,
    permission,
    requireReason: options.requireReason ?? COMMENT_ACTIONS.has(action),
    ...options,
  };
}

export const WORK_ORDER_ACTIONS = {
  submit: engineeringAction("submit", "Submit", "engineeringWorkOrder:create" as Permission),
  approve: engineeringAction("approve", "Approve", "engineeringWorkOrder:approve" as Permission),
  reject: engineeringAction("reject", "Reject", "engineeringWorkOrder:approve" as Permission, {
    variant: "destructive",
  }),
  assign: engineeringAction("assign", "Assign", "engineeringWorkOrder:update" as Permission, { requireReason: false }),
  start: engineeringAction("start", "Start work", "engineeringWorkOrder:update" as Permission, { requireReason: false }),
  wait_parts: engineeringAction("wait_parts", "Waiting for parts", "engineeringWorkOrder:update" as Permission),
  complete_work: engineeringAction("complete_work", "Complete work", "engineeringWorkOrder:update" as Permission, {
    requireReason: false,
  }),
  engineering_review: engineeringAction("engineering_review", "Engineering review", "engineeringWorkOrder:approve" as Permission),
  qa_review: engineeringAction("qa_review", "QA review", "engineeringWorkOrder:approve" as Permission),
  close: engineeringAction("close", "Close", "engineeringWorkOrder:close" as Permission),
  reopen: engineeringAction("reopen", "Reopen", "engineeringWorkOrder:approve" as Permission),
  cancel: engineeringAction("cancel", "Cancel", "engineeringWorkOrder:update" as Permission, { variant: "destructive" }),
  reserve_spares: engineeringAction("reserve_spares", "Reserve spares", "engineeringWorkOrder:update" as Permission, {
    requireReason: false,
  }),
};

export const BREAKDOWN_ACTIONS = {
  acknowledge: engineeringAction("acknowledge", "Acknowledge", "engineeringWorkOrder:update" as Permission),
  repair: engineeringAction("repair", "Under repair", "engineeringWorkOrder:update" as Permission, { requireReason: false }),
  restore: engineeringAction("restore", "Restore service", "engineeringWorkOrder:update" as Permission, { requireReason: false }),
  qa_assessment: engineeringAction("qa_assessment", "QA assessment", "engineeringWorkOrder:update" as Permission),
  close: engineeringAction("close", "Close", "engineeringWorkOrder:close" as Permission),
  cancel: engineeringAction("cancel", "Cancel", "engineeringWorkOrder:update" as Permission, { variant: "destructive" }),
};

export const CALIBRATION_ACTIONS = {
  request: engineeringAction("request", "Request", "engineeringCalibration:create" as Permission, { requireReason: false }),
  approve: engineeringAction("approve", "Approve", "engineeringCalibration:approve" as Permission),
  start: engineeringAction("start", "Start", "engineeringCalibration:update" as Permission, { requireReason: false }),
  pass: engineeringAction("pass", "Pass review", "engineeringCalibration:approve" as Permission),
  fail: engineeringAction("fail", "Fail review", "engineeringCalibration:approve" as Permission, { variant: "destructive" }),
  oot: engineeringAction("oot", "Out of tolerance", "engineeringCalibration:approve" as Permission, { variant: "destructive" }),
  close: engineeringAction("close", "Close record", "engineeringCalibration:approve" as Permission),
  cancel: engineeringAction("cancel", "Cancel", "engineeringCalibration:update" as Permission, { variant: "destructive" }),
};

export const QUALIFICATION_ACTIONS = {
  approve_protocol: engineeringAction("approve_protocol", "Approve protocol", "engineeringQualification:approve" as Permission),
  start: engineeringAction("start", "Start execution", "engineeringQualification:approve" as Permission, {
    requireReason: false,
  }),
  submit_review: engineeringAction("submit_review", "Submit for review", "engineeringQualification:approve" as Permission, {
    requireReason: false,
  }),
  approve: engineeringAction("approve", "Approve", "engineeringQualification:approve" as Permission),
  make_effective: engineeringAction("make_effective", "Make effective", "engineeringQualification:approve" as Permission),
  reject: engineeringAction("reject", "Reject", "engineeringQualification:approve" as Permission, { variant: "destructive" }),
};

export const MAINTENANCE_PLAN_ACTIONS = {
  generate_tasks: engineeringAction("generate_tasks", "Generate tasks", "engineeringMaintenance:create" as Permission, {
    requireReason: false,
    payload: { horizonDays: 30 },
  }),
};

export const MAINTENANCE_TASK_ACTIONS = {
  complete: engineeringAction("complete", "Complete task", "engineeringMaintenance:update" as Permission, {
    requireReason: false,
  }),
};

export const UTILITY_ALERT_ACTIONS = {
  acknowledge: engineeringAction("acknowledge", "Acknowledge", "engineeringMonitoring:update" as Permission),
};

export function EngineeringWorkflowActions({
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
  actions: EngineeringWorkflowAction[];
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const confirm = useConfirm();

  async function run(item: EngineeringWorkflowAction) {
    const accepted = await confirm({
      title: item.label,
      description: "This engineering action is audited and validated on the server.",
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
    try {
      await runEngineeringAction(resource, id, item.action, { ...item.payload, comment, reason: comment });
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

export function EquipmentTransitionActions({
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
  const nextStatuses = EQUIPMENT_TRANSITIONS[status] || [];

  async function transition(toStatus: string) {
    const accepted = await confirm({
      title: "Change equipment status",
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
      await runEngineeringAction("equipment", id, "transition", { toStatus, comment: reason, reason });
      toast.success("Equipment status updated");
      onChanged();
    } catch (error) {
      toast.error("Unable to transition", publicMasterError(error));
    }
  }

  if (!nextStatuses.length) return null;

  return (
    <div className="mb-6 rounded-xl border bg-card p-4">
      <p className="mb-3 text-sm font-medium">Equipment status transitions</p>
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((toStatus) =>
          can("engineeringEquipment:update" as Permission) ? (
            <Button key={toStatus} size="sm" className="min-h-11" variant="outline" onClick={() => void transition(toStatus)}>
              → {labelFor(equipmentStatusOptions, toStatus)}
            </Button>
          ) : null
        )}
      </div>
    </div>
  );
}
