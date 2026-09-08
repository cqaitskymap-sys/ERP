"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/feedback/status-badge";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/hooks/use-confirm";
import { setMasterRecordStatus } from "@/lib/masters/client";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import { labelFor, partnerStatusOptions } from "@/lib/partners/catalog";
import {
  allowedPartnerTransitions,
  permissionForPartnerTransition,
} from "@/lib/partners/status";
import type { MasterEntity } from "@/types/masters";

const STEPS = ["draft", "submitted", "document_review", "qualification", "qa_review", "approved", "active"];

export function WorkflowBar({
  entity,
  id,
  status,
  onChanged,
}: {
  entity: "customers" | "vendors";
  id: string;
  status: string;
  onChanged: () => void;
}) {
  const { can } = useAuth();
  const confirm = useConfirm();
  const next = allowedPartnerTransitions(status);

  async function transition(target: string) {
    const reasonNeeded = target === "rejected" || target === "suspended";
    const accepted = await confirm({
      title: `Change status to ${labelFor(partnerStatusOptions, target)}?`,
      description: reasonNeeded
        ? "This change is audited and requires a reason. Continue to confirm."
        : "This workflow change is recorded in the audit trail.",
      confirmLabel: "Continue",
    });
    if (!accepted) return;
    let reason: string | undefined;
    if (reasonNeeded) {
      reason = window.prompt("Enter a reason for this change") || "";
      if (!reason.trim()) {
        toast.error("A reason is required");
        return;
      }
    }
    try {
      await setMasterRecordStatus(entity as MasterEntity, id, target, reason);
      toast.success("Status updated");
      onChanged();
    } catch (error) {
      toast.error("Unable to change status", publicMasterError(error));
    }
  }

  return (
    <div className="mb-6 rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap gap-2">
        {STEPS.map((step) => (
          <StatusBadge
            key={step}
            label={labelFor(partnerStatusOptions, step)}
            tone={step === status ? "info" : STEPS.indexOf(step) < STEPS.indexOf(status) ? "success" : "neutral"}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {next.map((target) => {
          const permission = permissionForPartnerTransition(entity, target);
          if (!can(permission)) return null;
          return (
            <Button
              key={target}
              size="sm"
              variant={target === "rejected" || target === "suspended" ? "destructive" : "outline"}
              onClick={() => void transition(target)}
            >
              {labelFor(partnerStatusOptions, target)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
