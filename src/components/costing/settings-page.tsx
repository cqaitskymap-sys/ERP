"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
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
import { createCosting, listCosting } from "@/lib/costing/client";
import {
  allocationBasisOptions,
  costingMethodOptions,
} from "@/lib/costing/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function CostingSettingsPage() {
  return (
    <RequirePermission permission="costing:update">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [form, setForm] = useState({
    methodology: "actual",
    methodologyVersion: "1.0",
    currency: "INR",
    materialValuationSource: "purchase_order",
    laborRateSource: "rate_card",
    machineRateSource: "rate_card",
    overheadAllocationBasis: "direct_material_cost",
    outputQuantityPolicy: "saleable",
    varianceThresholdPercent: "5",
    yieldTolerancePercent: "2",
    allowEstimatedWhenMissing: "false",
    requireLabor: "false",
    requireMachine: "false",
    requireOverhead: "false",
    requireVarianceExplanation: "true",
    approvalRequired: "true",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listCosting("settings", { pageSize: 1 })
        .then((result) => {
          const row = result.rows[0];
          if (!row) return;
          setForm({
            methodology: String(row.methodology || "actual"),
            methodologyVersion: String(row.methodologyVersion || "1.0"),
            currency: String(row.currency || "INR"),
            materialValuationSource: String(row.materialValuationSource || "purchase_order"),
            laborRateSource: String(row.laborRateSource || "rate_card"),
            machineRateSource: String(row.machineRateSource || "rate_card"),
            overheadAllocationBasis: String(row.overheadAllocationBasis || "direct_material_cost"),
            outputQuantityPolicy: String(row.outputQuantityPolicy || "saleable"),
            varianceThresholdPercent: String(row.varianceThresholdPercent ?? 5),
            yieldTolerancePercent: String(row.yieldTolerancePercent ?? 2),
            allowEstimatedWhenMissing: String(row.allowEstimatedWhenMissing ?? false),
            requireLabor: String(row.requireLabor ?? false),
            requireMachine: String(row.requireMachine ?? false),
            requireOverhead: String(row.requireOverhead ?? false),
            requireVarianceExplanation: String(row.requireVarianceExplanation ?? true),
            approvalRequired: String(row.approvalRequired ?? true),
          });
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function save() {
    try {
      await createCosting("settings", {
        methodology: form.methodology,
        methodologyVersion: form.methodologyVersion,
        currency: form.currency,
        materialValuationSource: form.materialValuationSource,
        laborRateSource: form.laborRateSource,
        machineRateSource: form.machineRateSource,
        overheadAllocationBasis: form.overheadAllocationBasis,
        outputQuantityPolicy: form.outputQuantityPolicy,
        varianceThresholdPercent: Number(form.varianceThresholdPercent),
        yieldTolerancePercent: Number(form.yieldTolerancePercent),
        allowEstimatedWhenMissing: form.allowEstimatedWhenMissing === "true",
        requireLabor: form.requireLabor === "true",
        requireMachine: form.requireMachine === "true",
        requireOverhead: form.requireOverhead === "true",
        requireVarianceExplanation: form.requireVarianceExplanation === "true",
        approvalRequired: form.approvalRequired === "true",
      });
      toast.success("Costing settings saved");
    } catch (error) {
      toast.error("Unable to save settings", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader
        title="Costing settings"
        description="Methodology, valuation sources, completeness rules, and approval thresholds."
      />
      <div className="mb-6 grid max-w-2xl gap-3">
        <Field label="Methodology">
          <Select value={form.methodology} onValueChange={(value) => setForm({ ...form, methodology: value })}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {costingMethodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Methodology version">
          <Input
            className="min-h-11"
            value={form.methodologyVersion}
            onChange={(e) => setForm({ ...form, methodologyVersion: e.target.value })}
          />
        </Field>
        <Field label="Default currency">
          <Input className="min-h-11" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        </Field>
        <Field label="Overhead allocation basis">
          <Select
            value={form.overheadAllocationBasis}
            onValueChange={(value) => setForm({ ...form, overheadAllocationBasis: value })}
          >
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allocationBasisOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Variance threshold (%)">
          <Input
            className="min-h-11"
            type="number"
            value={form.varianceThresholdPercent}
            onChange={(e) => setForm({ ...form, varianceThresholdPercent: e.target.value })}
          />
        </Field>
        <Field label="Yield tolerance (%)">
          <Input
            className="min-h-11"
            type="number"
            value={form.yieldTolerancePercent}
            onChange={(e) => setForm({ ...form, yieldTolerancePercent: e.target.value })}
          />
        </Field>
        <ToggleRow
          label="Require variance explanation"
          value={form.requireVarianceExplanation}
          onChange={(value) => setForm({ ...form, requireVarianceExplanation: value })}
        />
        <ToggleRow
          label="Allow estimated costs when data missing"
          value={form.allowEstimatedWhenMissing}
          onChange={(value) => setForm({ ...form, allowEstimatedWhenMissing: value })}
        />
        <ToggleRow label="Require labor" value={form.requireLabor} onChange={(value) => setForm({ ...form, requireLabor: value })} />
        <ToggleRow
          label="Require machine"
          value={form.requireMachine}
          onChange={(value) => setForm({ ...form, requireMachine: value })}
        />
        <ToggleRow
          label="Require overhead"
          value={form.requireOverhead}
          onChange={(value) => setForm({ ...form, requireOverhead: value })}
        />
      </div>
      <Button className="min-h-11" onClick={() => void save()}>
        Save settings
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
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
