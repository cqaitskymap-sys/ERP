"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { AuditHistory } from "@/components/products/audit-history";
import { ProductionList } from "@/components/production/production-list";
import { ProductionWorkflowActions, type ProductionWorkflowAction } from "@/components/production/workflow-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getProduction } from "@/lib/production/client";
import {
  batchPlanStatusOptions,
  bmrStatusOptions,
  bomStatusOptions,
  deviationStatusOptions,
  dispensingStatusOptions,
  labelFor,
  moStatusOptions,
  planStatusOptions,
  workflowTone,
} from "@/lib/production/catalog";
import { publicMasterError } from "@/lib/masters/errors";

type Row = Record<string, unknown> & { id: string };

export function PlanList() {
  return (
    <ProductionList
      title="Production plans"
      description="Customer demand converted into multi-product production plans."
      resource="plans"
      permission="productionPlan:read"
      createHref="/production/plans/new"
      createLabel="New plan"
      exportColumns={["planNumber", "plantId", "customerId", "productId", "priority", "status", "targetDate"]}
      rowHref={(row) => `/production/plans/${row.id}`}
      columns={[
        { key: "planNumber", header: "Plan" },
        { key: "productionPeriod", header: "Period", hideOnMobile: true },
        { key: "priority", header: "Priority", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(planStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function BatchPlanList() {
  return (
    <ProductionList
      title="Batch planning"
      description="Required quantity divided by batch size using configurable rounding."
      resource="batchPlans"
      permission="batchPlan:read"
      createHref="/production/batch-planning/new"
      createLabel="New batch plan"
      exportColumns={["batchPlanNumber", "productId", "requiredQuantity", "batchSize", "plannedBatchCount", "status"]}
      rowHref={(row) => `/production/batch-planning/${row.id}`}
      columns={[
        { key: "batchPlanNumber", header: "Plan" },
        { key: "plannedBatchCount", header: "Batches" },
        { key: "batchSize", header: "Batch size", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(batchPlanStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function ManufacturingOrderList() {
  return (
    <ProductionList
      title="Manufacturing orders"
      description="Server-generated batch numbers with QC/QA integration states only."
      resource="orders"
      permission="manufacturingOrder:read"
      createHref="/production/orders/new"
      createLabel="New order"
      exportColumns={["manufacturingOrderNumber", "batchNumber", "productId", "customerId", "status", "qcStatus", "qaStatus"]}
      rowHref={(row) => `/production/orders/${row.id}`}
      columns={[
        { key: "batchNumber", header: "Batch" },
        { key: "productId", header: "Product" },
        { key: "customerId", header: "Customer", hideOnMobile: true },
        { key: "batchSize", header: "Size", hideOnMobile: true },
        { key: "plannedStartDate", header: "Start", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(moStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function BomList() {
  return (
    <ProductionList
      title="BOM / formula"
      description="Version-controlled manufacturing formulas. Historical versions stay immutable."
      resource="boms"
      permission="bom:read"
      createHref="/production/boms/new"
      createLabel="New BOM"
      exportColumns={["bomNumber", "productId", "version", "status", "effectiveDate"]}
      rowHref={(row) => `/production/boms/${row.id}`}
      columns={[
        { key: "bomNumber", header: "BOM" },
        { key: "version", header: "Version" },
        { key: "productId", header: "Product", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(bomStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function DispensingList() {
  return (
    <ProductionList
      title="Dispensing requests"
      description="Request foundation only. Stock is not consumed when a request is created."
      resource="dispensing"
      permission="dispensingRequest:read"
      createHref="/production/dispensing/new"
      createLabel="New request"
      exportColumns={["dispensingRequestNumber", "batchNumber", "status", "requiredDate"]}
      rowHref={(row) => `/production/dispensing/${row.id}`}
      columns={[
        { key: "dispensingRequestNumber", header: "Request" },
        { key: "batchNumber", header: "Batch" },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(dispensingStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function WorkCenterList() {
  return (
    <ProductionList
      title="Work centers"
      description="Configurable manufacturing work centers used by schedules and orders."
      resource="workCenters"
      permission="production:read"
      createHref="/production/work-centers/new"
      createLabel="New work center"
      exportColumns={["workCenterCode", "workCenterName", "workCenterType", "status"]}
      rowHref={(row) => `/production/work-centers/${row.id}`}
      columns={[
        { key: "workCenterCode", header: "Code" },
        { key: "workCenterName", header: "Name" },
        { key: "workCenterType", header: "Type", hideOnMobile: true },
      ]}
    />
  );
}

export function EquipmentList() {
  return (
    <ProductionList
      title="Equipment"
      description="Assignment foundation. Eligibility is enforced before production start."
      resource="equipment"
      permission="production:read"
      createHref="/production/equipment/new"
      createLabel="New equipment"
      exportColumns={["equipmentCode", "equipmentName", "status", "qualificationStatus", "calibrationStatus"]}
      rowHref={(row) => `/production/equipment/${row.id}`}
      columns={[
        { key: "equipmentCode", header: "Code" },
        { key: "equipmentName", header: "Name" },
        { key: "qualificationStatus", header: "Qualification", hideOnMobile: true },
      ]}
    />
  );
}

export function BmrList() {
  return (
    <ProductionList
      title="Batch records"
      description="Batch manufacturing record foundation linked to order, BOM, and process version."
      resource="bmrs"
      permission="bmr:read"
      createHref="/production/records/new"
      createLabel="Issue BMR"
      exportColumns={["bmrNumber", "batchNumber", "productId", "status"]}
      rowHref={(row) => `/production/records/${row.id}`}
      columns={[
        { key: "bmrNumber", header: "BMR" },
        { key: "batchNumber", header: "Batch" },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(bmrStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function IpcList() {
  return (
    <ProductionList
      title="In-process checks"
      description="Recorded IPC values. Specifications are not invented by this module."
      resource="ipc"
      permission="ipc:read"
      createHref="/production/ipc/new"
      createLabel="Record IPC"
      exportColumns={["parameter", "actual", "result", "checkedBy"]}
      rowHref={() => "/production/ipc"}
      columns={[
        { key: "parameter", header: "Parameter" },
        { key: "actual", header: "Actual" },
        { key: "result", header: "Result", cell: (row) => <StatusBadge label={String(row.result || "pending")} tone={workflowTone(row.result)} /> },
      ]}
    />
  );
}

export function DeviationList() {
  return (
    <ProductionList
      title="Production deviations"
      description="Deviation foundation. Full CAPA is a future QA module."
      resource="deviations"
      permission="productionDeviation:read"
      createHref="/production/deviations/new"
      createLabel="New deviation"
      exportColumns={["deviationNumber", "batchNumber", "severity", "status"]}
      rowHref={(row) => `/production/deviations/${row.id}`}
      columns={[
        { key: "deviationNumber", header: "Deviation" },
        { key: "severity", header: "Severity" },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(deviationStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function ProductionDocumentDetail({
  resource,
  id,
  permission,
  titleKey,
  statusOptions,
  actions,
  auditResource,
}: {
  resource: string;
  id: string;
  permission: "productionPlan:read" | "productionSchedule:read" | "batchPlan:read" | "bom:read" | "dispensingRequest:read" | "bmr:read" | "productionDeviation:read" | "production:read";
  titleKey: string;
  statusOptions: Array<{ label: string; value: string }>;
  actions: ProductionWorkflowAction[];
  auditResource: string;
}) {
  return (
    <RequirePermission permission={permission}>
      <DetailInner
        resource={resource}
        id={id}
        titleKey={titleKey}
        statusOptions={statusOptions}
        actions={actions}
        auditResource={auditResource}
      />
    </RequirePermission>
  );
}

function DetailInner({
  resource,
  id,
  titleKey,
  statusOptions,
  actions,
  auditResource,
}: {
  resource: string;
  id: string;
  titleKey: string;
  statusOptions: Array<{ label: string; value: string }>;
  actions: ProductionWorkflowAction[];
  auditResource: string;
}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  function reload() {
    void getProduction(resource, id)
      .then((result) => {
        setRecord(result.record);
        setExtra(result.extra || {});
      })
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) return <EmptyState title="Record not found" description={error || ""} />;

  const items = (extra.items as Row[]) || [];
  const steps = (extra.steps as Row[]) || [];
  const approvals = (extra.approvals as Row[]) || [];

  return (
    <div>
      <PageHeader
        title={String(record[titleKey] || id)}
        description="Controlled production record with server-side validation and audit history."
        actions={
          resource === "orders" ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/production/orders/${id}`}>Batch detail</Link>
            </Button>
          ) : null
        }
      />
      <ProductionWorkflowActions
        resource={resource}
        id={id}
        status={String(record.status)}
        statusOptions={statusOptions}
        actions={actions}
        onChanged={reload}
      />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {Object.entries(record)
          .filter(([key]) => !["searchIndex", "nameIndex", "createdBy", "updatedBy", "id", "_updateTime", "previousValues", "newValues"].includes(key))
          .slice(0, 14)
          .map(([key, value]) => (
            <Card key={key}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground">{key}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</CardContent>
            </Card>
          ))}
      </div>
      {items.length ? (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold">Lines</h2>
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-sm">
              {String(item.productId || item.materialId || item.stepName || item.id)} · {String(item.quantity || item.requiredQuantity || "")} {String(item.uom || "")}
              {item.shortage !== undefined ? ` · shortage ${String(item.shortage)}` : ""}
            </div>
          ))}
        </div>
      ) : null}
      {steps.length ? (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold">Process steps</h2>
          {steps.map((step) => (
            <div key={step.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span>{String(step.sequence)} · {String(step.stepName)}</span>
              <StatusBadge label={String(step.status)} tone={workflowTone(step.status)} />
            </div>
          ))}
        </div>
      ) : null}
      {approvals.length ? (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold">Approval steps</h2>
          {approvals.map((step) => (
            <div key={step.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span>Step {String(step.step)} · {String(step.label || step.role)}</span>
              <StatusBadge label={String(step.status)} tone={workflowTone(step.status)} />
            </div>
          ))}
        </div>
      ) : null}
      <AuditHistory resource={auditResource} resourceId={id} />
    </div>
  );
}

export const planActions: ProductionWorkflowAction[] = [
  { action: "submit", label: "Submit", permission: "productionPlan:submit" },
  { action: "approve", label: "Approve", permission: "productionPlan:approve" },
  { action: "reject", label: "Reject", permission: "productionPlan:approve", variant: "destructive", requireReason: true },
  { action: "return", label: "Return", permission: "productionPlan:approve", requireReason: true },
  { action: "cancel", label: "Cancel", permission: "productionPlan:cancel", variant: "destructive", requireReason: true },
];

export const scheduleActions: ProductionWorkflowAction[] = [
  { action: "schedule", label: "Schedule", permission: "productionSchedule:update" },
  { action: "ready", label: "Mark ready", permission: "productionSchedule:update" },
  { action: "start", label: "Start", permission: "productionSchedule:update" },
  { action: "pause", label: "Pause", permission: "productionSchedule:update" },
  { action: "complete", label: "Complete", permission: "productionSchedule:update" },
  { action: "cancel", label: "Cancel", permission: "productionSchedule:update", variant: "destructive", requireReason: true },
];

export const bomActions: ProductionWorkflowAction[] = [
  { action: "submit", label: "Submit", permission: "bom:submit" },
  { action: "approve", label: "Approve", permission: "bom:approve" },
  { action: "reject", label: "Reject", permission: "bom:approve", variant: "destructive", requireReason: true },
  { action: "return", label: "Return", permission: "bom:approve", requireReason: true },
  { action: "activate", label: "Make effective", permission: "bom:approve" },
];

export const moActions: ProductionWorkflowAction[] = [
  { action: "submit", label: "Submit", permission: "manufacturingOrder:update" },
  { action: "approve", label: "Approve", permission: "manufacturingOrder:approve" },
  { action: "reject", label: "Reject", permission: "manufacturingOrder:approve", variant: "destructive", requireReason: true },
  { action: "start", label: "Start", permission: "manufacturingOrder:start" },
  { action: "pause", label: "Pause", permission: "manufacturingOrder:pause" },
  { action: "resume", label: "Resume", permission: "manufacturingOrder:start" },
  { action: "complete", label: "Complete → QC pending", permission: "manufacturingOrder:complete" },
  { action: "cancel", label: "Cancel", permission: "manufacturingOrder:update", variant: "destructive", requireReason: true },
];

export const dispensingActions: ProductionWorkflowAction[] = [
  { action: "approve", label: "Approve", permission: "dispensingRequest:approve" },
  { action: "cancel", label: "Cancel", permission: "dispensingRequest:update", variant: "destructive", requireReason: true },
];

export const bmrActions: ProductionWorkflowAction[] = [
  { action: "start", label: "Start", permission: "bmr:execute" },
  { action: "pause", label: "Pause", permission: "bmr:update" },
  { action: "complete", label: "Complete", permission: "bmr:complete" },
  { action: "review", label: "Review", permission: "bmr:review" },
];

