"use client";

import { useState, type ReactNode } from "react";
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
import { createCosting } from "@/lib/costing/client";
import { allocationBasisOptions, varianceTypeOptions } from "@/lib/costing/catalog";
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

export function ProductStandardForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    productId: "",
    bomId: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    standardBatchSize: "",
    standardYieldPercent: "100",
    laborHours: "0",
    laborRate: "0",
    machineHours: "0",
    machineRate: "0",
    overheadAmount: "0",
    qualityAmount: "0",
    currency: "INR",
    notes: "",
  });

  return (
    <FormShell
      permission="costingStandard:create"
      title="New product standard cost"
      description="Calculate standard cost from an approved BOM plus labor, machine, and overhead inputs."
      onSubmit={async () => {
        const result = await createCosting("standards", {
          productId: form.productId,
          bomId: form.bomId,
          effectiveFrom: form.effectiveFrom,
          standardBatchSize: Number(form.standardBatchSize || 0),
          standardYieldPercent: Number(form.standardYieldPercent || 100),
          laborHours: Number(form.laborHours || 0),
          laborRate: Number(form.laborRate || 0),
          machineHours: Number(form.machineHours || 0),
          machineRate: Number(form.machineRate || 0),
          overheadAmount: Number(form.overheadAmount || 0),
          qualityAmount: Number(form.qualityAmount || 0),
          currency: form.currency,
          notes: form.notes,
        });
        toast.success("Standard cost calculated");
        router.push(`/costing/standards/${result.id}`);
      }}
    >
      <Field label="Product ID">
        <Input className="min-h-11" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required />
      </Field>
      <Field label="BOM ID">
        <Input className="min-h-11" value={form.bomId} onChange={(e) => setForm({ ...form, bomId: e.target.value })} required />
      </Field>
      <Field label="Effective from">
        <Input className="min-h-11" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required />
      </Field>
      <Field label="Standard batch size">
        <Input
          className="min-h-11"
          type="number"
          min={0}
          value={form.standardBatchSize}
          onChange={(e) => setForm({ ...form, standardBatchSize: e.target.value })}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Labor hours">
          <Input className="min-h-11" type="number" min={0} value={form.laborHours} onChange={(e) => setForm({ ...form, laborHours: e.target.value })} />
        </Field>
        <Field label="Labor rate">
          <Input className="min-h-11" type="number" min={0} value={form.laborRate} onChange={(e) => setForm({ ...form, laborRate: e.target.value })} />
        </Field>
        <Field label="Machine hours">
          <Input className="min-h-11" type="number" min={0} value={form.machineHours} onChange={(e) => setForm({ ...form, machineHours: e.target.value })} />
        </Field>
        <Field label="Machine rate">
          <Input className="min-h-11" type="number" min={0} value={form.machineRate} onChange={(e) => setForm({ ...form, machineRate: e.target.value })} />
        </Field>
        <Field label="Overhead amount">
          <Input className="min-h-11" type="number" min={0} value={form.overheadAmount} onChange={(e) => setForm({ ...form, overheadAmount: e.target.value })} />
        </Field>
        <Field label="Quality amount">
          <Input className="min-h-11" type="number" min={0} value={form.qualityAmount} onChange={(e) => setForm({ ...form, qualityAmount: e.target.value })} />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function BatchCostingForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    manufacturingOrderId: "",
    productStandardId: "",
    costCenterId: "",
    customerId: "",
    notes: "",
  });

  return (
    <FormShell
      permission="costingBatch:create"
      title="New batch costing"
      description="Build actual batch cost from manufacturing order consumption, yield, and rate cards."
      onSubmit={async () => {
        const result = await createCosting("batches", {
          manufacturingOrderId: form.manufacturingOrderId,
          productStandardId: form.productStandardId || undefined,
          costCenterId: form.costCenterId || undefined,
          customerId: form.customerId || undefined,
          notes: form.notes || undefined,
        });
        toast.success("Batch costing created");
        router.push(`/costing/batches/${result.id}`);
      }}
    >
      <Field label="Manufacturing order ID">
        <Input
          className="min-h-11"
          value={form.manufacturingOrderId}
          onChange={(e) => setForm({ ...form, manufacturingOrderId: e.target.value })}
          required
        />
      </Field>
      <Field label="Product standard ID (optional)">
        <Input
          className="min-h-11"
          value={form.productStandardId}
          onChange={(e) => setForm({ ...form, productStandardId: e.target.value })}
        />
      </Field>
      <Field label="Cost center ID">
        <Input className="min-h-11" value={form.costCenterId} onChange={(e) => setForm({ ...form, costCenterId: e.target.value })} />
      </Field>
      <Field label="Customer ID (CMO)">
        <Input className="min-h-11" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
    </FormShell>
  );
}

export function RateCardForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    rateType: "labor",
    referenceId: "",
    rate: "0",
    uom: "hour",
    currency: "INR",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    status: "active",
  });

  return (
    <FormShell
      permission="costing:update"
      title="New rate card"
      description="Labor, machine, overhead, or material standard rates used by costing calculations."
      onSubmit={async () => {
        await createCosting("rateCards", {
          name: form.name,
          rateType: form.rateType,
          referenceId: form.referenceId || undefined,
          rate: Number(form.rate || 0),
          uom: form.uom,
          currency: form.currency,
          effectiveFrom: form.effectiveFrom,
          status: form.status,
        });
        toast.success("Rate card created");
        router.push("/costing/rate-cards");
      }}
    >
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Rate type">
        <Select value={form.rateType} onValueChange={(value) => setForm({ ...form, rateType: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["labor", "machine", "overhead", "quality", "material_standard"].map((value) => (
              <SelectItem key={value} value={value}>
                {value.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Reference ID">
        <Input className="min-h-11" value={form.referenceId} onChange={(e) => setForm({ ...form, referenceId: e.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Rate">
          <Input className="min-h-11" type="number" min={0} value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
        </Field>
        <Field label="UOM">
          <Input className="min-h-11" value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} />
        </Field>
      </div>
      <Field label="Effective from">
        <Input className="min-h-11" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required />
      </Field>
    </FormShell>
  );
}

export function AllocationRuleForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    costPoolAmount: "0",
    allocationBasis: "direct_material_cost",
    costCenterId: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    currency: "INR",
    status: "active",
  });

  return (
    <FormShell
      permission="costing:update"
      title="New overhead allocation rule"
      description="Define how overhead pools are absorbed into batch costs."
      onSubmit={async () => {
        await createCosting("allocationRules", {
          name: form.name,
          costPoolAmount: Number(form.costPoolAmount || 0),
          allocationBasis: form.allocationBasis,
          costCenterId: form.costCenterId || undefined,
          effectiveFrom: form.effectiveFrom,
          currency: form.currency,
          status: form.status,
        });
        toast.success("Allocation rule created");
        router.push("/costing/allocation-rules");
      }}
    >
      <Field label="Name">
        <Input className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Cost pool amount">
        <Input
          className="min-h-11"
          type="number"
          min={0}
          value={form.costPoolAmount}
          onChange={(e) => setForm({ ...form, costPoolAmount: e.target.value })}
        />
      </Field>
      <Field label="Allocation basis">
        <Select value={form.allocationBasis} onValueChange={(value) => setForm({ ...form, allocationBasis: value })}>
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
      <Field label="Cost center ID">
        <Input className="min-h-11" value={form.costCenterId} onChange={(e) => setForm({ ...form, costCenterId: e.target.value })} />
      </Field>
      <Field label="Effective from">
        <Input className="min-h-11" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required />
      </Field>
    </FormShell>
  );
}

export function InvestigationForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    batchCostingId: "",
    varianceType: "total_batch",
    amount: "0",
    explanation: "",
    responsibleDepartmentId: "",
    deviationId: "",
  });

  return (
    <FormShell
      permission="costingVariance:review"
      title="New variance investigation"
      description="Document root cause for an unfavorable batch variance."
      onSubmit={async () => {
        await createCosting("investigations", {
          batchCostingId: form.batchCostingId,
          varianceType: form.varianceType,
          amount: Number(form.amount || 0),
          explanation: form.explanation,
          responsibleDepartmentId: form.responsibleDepartmentId || undefined,
          deviationId: form.deviationId || undefined,
        });
        toast.success("Investigation created");
        router.push(`/costing/batches/${form.batchCostingId}`);
      }}
    >
      <Field label="Batch costing ID">
        <Input
          className="min-h-11"
          value={form.batchCostingId}
          onChange={(e) => setForm({ ...form, batchCostingId: e.target.value })}
          required
        />
      </Field>
      <Field label="Variance type">
        <Select value={form.varianceType} onValueChange={(value) => setForm({ ...form, varianceType: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {varianceTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Amount">
        <Input className="min-h-11" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
      </Field>
      <Field label="Explanation">
        <Textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} required />
      </Field>
      <Field label="Responsible department ID">
        <Input
          className="min-h-11"
          value={form.responsibleDepartmentId}
          onChange={(e) => setForm({ ...form, responsibleDepartmentId: e.target.value })}
        />
      </Field>
    </FormShell>
  );
}
