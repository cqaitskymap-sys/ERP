"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/hooks/use-confirm";
import { runFinanceAction } from "@/lib/finance/client";
import { labelFor, workflowTone } from "@/lib/finance/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

const COMMENT_ACTIONS = new Set([
  "reject",
  "reverse",
  "hold",
  "close",
  "reopen",
  "deactivate",
  "submit_manual",
  "post",
]);

export interface FinanceWorkflowAction {
  action: string;
  label: string;
  permission: Permission;
  variant?: "default" | "outline" | "destructive";
  requireReason?: boolean;
  payload?: Record<string, unknown>;
}

export function financeAction(
  action: string,
  label: string,
  permission: Permission,
  options: Omit<FinanceWorkflowAction, "action" | "label" | "permission"> = {}
): FinanceWorkflowAction {
  return {
    action,
    label,
    permission,
    requireReason: options.requireReason ?? COMMENT_ACTIONS.has(action),
    ...options,
  };
}

export const COMMON_FINANCE_ACTIONS = {
  submit: financeAction("submit", "Submit", "finance:submit" as Permission),
  approve: financeAction("approve", "Approve", "finance:approve" as Permission),
  reject: financeAction("reject", "Reject", "finance:reject" as Permission, { variant: "destructive" }),
  post: financeAction("post", "Post to ledger", "finance:sign" as Permission),
  reverse: financeAction("reverse", "Reverse", "finance:sign" as Permission, { variant: "destructive" }),
  match: financeAction("match", "Run match", "finance:update" as Permission, { requireReason: false }),
  hold: financeAction("hold", "Place on hold", "finance:approve" as Permission),
  confirm: financeAction("confirm", "Confirm", "finance:confirm" as Permission, { requireReason: false }),
  submit_manual: financeAction("submit_manual", "Submit manual payment", "finance:submit" as Permission),
  close: financeAction("close", "Close period", "finance:close" as Permission),
  reopen: financeAction("reopen", "Reopen", "finance:reopen" as Permission),
  deactivate: financeAction("deactivate", "Deactivate account", "finance:update" as Permission, {
    variant: "destructive",
  }),
};

export function FinanceWorkflowActions({
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
  actions: FinanceWorkflowAction[];
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const confirm = useConfirm();

  async function run(item: FinanceWorkflowAction) {
    const accepted = await confirm({
      title: item.label,
      description: "This finance action is audited and validated on the server.",
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
      await runFinanceAction(resource, id, item.action, { ...item.payload, comment, reason: comment });
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
