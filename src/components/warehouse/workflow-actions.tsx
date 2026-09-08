"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/hooks/use-confirm";
import { runWarehouseAction } from "@/lib/inventory/client";
import { labelFor, workflowTone } from "@/lib/inventory/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

export interface WorkflowAction {
  action: string;
  label: string;
  permission: Permission;
  variant?: "default" | "outline" | "destructive";
  requireReason?: boolean;
}

export function WorkflowActions({
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
  actions: WorkflowAction[];
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const confirm = useConfirm();

  async function run(item: WorkflowAction) {
    const accepted = await confirm({
      title: item.label,
      description: "This warehouse action is audited and updates stock only after server-side validation.",
      confirmLabel: item.label,
    });
    if (!accepted) return;
    let reason: string | undefined;
    if (item.requireReason) {
      reason = window.prompt("Enter a reason") || "";
      if (!reason.trim()) {
        toast.error("A reason is required");
        return;
      }
    }
    try {
      await runWarehouseAction(resource, id, item.action, { reason });
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
