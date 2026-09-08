"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { roleCatalog } from "@/lib/permissions/catalog";
import type { ApprovalType, WorkflowStep } from "@/types/masters";

const approvalTypes: Array<{ label: string; value: ApprovalType }> = [
  { label: "Approve", value: "approve" },
  { label: "Reject", value: "reject" },
  { label: "Review", value: "review" },
  { label: "Acknowledge", value: "acknowledge" },
];

interface WorkflowStepsFieldProps {
  value: WorkflowStep[];
  disabled?: boolean;
  error?: string;
  onChange: (steps: WorkflowStep[]) => void;
}

export function WorkflowStepsField({
  value,
  disabled,
  error,
  onChange,
}: WorkflowStepsFieldProps) {
  const steps = value.length
    ? value
    : [
        {
          sequence: 1,
          role: "department_head",
          approvalType: "approve" as const,
          required: true,
          label: "Department Head",
        },
      ];

  function update(index: number, patch: Partial<WorkflowStep>) {
    onChange(
      steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch, sequence: stepIndex + 1 } : step
      )
    );
  }

  return (
    <div className="grid gap-3 md:col-span-2">
      <div className="flex items-center justify-between">
        <Label>Approval steps</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() =>
            onChange([
              ...steps,
              {
                sequence: steps.length + 1,
                role: "qa",
                approvalType: "review",
                required: true,
                label: `Step ${steps.length + 1}`,
              },
            ])
          }
        >
          <Plus className="size-3.5" />
          Add step
        </Button>
      </div>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={`${step.sequence}-${index}`}
            className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2"
          >
            <div className="grid gap-1.5">
              <Label>Label</Label>
              <Input
                value={step.label}
                disabled={disabled}
                onChange={(event) => update(index, { label: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select
                value={step.role}
                disabled={disabled}
                onValueChange={(role) => update(index, { role })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleCatalog.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Approval type</Label>
              <Select
                value={step.approvalType}
                disabled={disabled}
                onValueChange={(approvalType) =>
                  update(index, { approvalType: approvalType as ApprovalType })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {approvalTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={step.required}
                  disabled={disabled}
                  onCheckedChange={(required) => update(index, { required })}
                />
                Required
              </label>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={disabled || steps.length === 1}
                onClick={() =>
                  onChange(
                    steps
                      .filter((_, stepIndex) => stepIndex !== index)
                      .map((item, stepIndex) => ({ ...item, sequence: stepIndex + 1 }))
                  )
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
