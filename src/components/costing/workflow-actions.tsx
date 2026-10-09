"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/hooks/use-confirm";
import { runCostingAction } from "@/lib/costing/client";
import { labelFor, workflowTone } from "@/lib/costing/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

const COMMENT_ACTIONS = new Set(["reject", "reopen"]);
const VARIANCE_PROMPT_ACTIONS = new Set(["submit", "approve", "finalize"]);

export interface CostingWorkflowAction {
  action: string;
  label: string;
  permission: Permission;
  variant?: "default" | "outline" | "destructive";
  requireReason?: boolean;
  requireVarianceExplanation?: boolean;
  payload?: Record<string, unknown>;
}

export function costingAction(
  action: string,
  label: string,
  permission: Permission,
  options: Omit<CostingWorkflowAction, "action" | "label" | "permission"> = {}
): CostingWorkflowAction {
  return {
    action,
    label,
    permission,
    requireReason: options.requireReason ?? COMMENT_ACTIONS.has(action),
    requireVarianceExplanation:
      options.requireVarianceExplanation ?? VARIANCE_PROMPT_ACTIONS.has(action),
    ...options,
  };
}

export const COMMON_COSTING_ACTIONS = {
  submit: costingAction("submit", "Submit for review", "costing:update" as Permission, {
    requireVarianceExplanation: true,
  }),
  approve: costingAction("approve", "Approve", "costing:approve" as Permission, {
    requireVarianceExplanation: true,
  }),
  reject: costingAction("reject", "Reject", "costing:reject" as Permission, { variant: "destructive" }),
  finalize: costingAction("finalize", "Finalize", "costing:approve" as Permission, {
    requireVarianceExplanation: true,
  }),
  reopen: costingAction("reopen", "Reopen", "costing:reopen" as Permission),
  recalculate: costingAction("recalculate", "Recalculate", "costingBatch:execute" as Permission, {
    requireReason: false,
    requireVarianceExplanation: false,
  }),
  reconcile: costingAction("reconcile", "Reconcile to ledger", "costing:reconcile" as Permission, {
    requireReason: false,
    requireVarianceExplanation: false,
  }),
};

export function CostingWorkflowActions({
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
  actions: CostingWorkflowAction[];
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const confirm = useConfirm();

  async function run(item: CostingWorkflowAction) {
    const accepted = await confirm({
      title: item.label,
      description: "This costing action is audited and validated on the server.",
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

    let varianceExplanation: string | undefined;
    if (item.requireVarianceExplanation) {
      varianceExplanation = window.prompt("Variance explanation (required when unfavorable variance exists)") || "";
    }

    try {
      await runCostingAction(resource, id, item.action, {
        ...item.payload,
        comment,
        reason: comment,
        varianceExplanation,
      });
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
