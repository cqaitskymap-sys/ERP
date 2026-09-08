"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/hooks/use-confirm";
import { runProcurementAction } from "@/lib/procurement/client";
import { labelFor, workflowTone } from "@/lib/procurement/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

export interface ProcurementWorkflowAction {
  action: string;
  label: string;
  permission: Permission;
  variant?: "default" | "outline" | "destructive";
  requireReason?: boolean;
}

export function ProcurementWorkflowActions({
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
  actions: ProcurementWorkflowAction[];
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const confirm = useConfirm();

  async function run(item: ProcurementWorkflowAction) {
    const accepted = await confirm({
      title: item.label,
      description: "This procurement action is audited and validated on the server.",
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
      await runProcurementAction(resource, id, item.action, { comment, reason: comment });
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
              key={item.action}
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
