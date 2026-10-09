"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CostingList } from "@/components/costing/costing-list";
import { COMMON_COSTING_ACTIONS, CostingWorkflowActions } from "@/components/costing/workflow-actions";
import { CostingReportsPage } from "@/components/costing/reports-page";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { getCosting } from "@/lib/costing/client";
import { costingStatusOptions, labelFor, workflowTone } from "@/lib/costing/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

const P = {
  costing: "costing:read" as Permission,
  standard: "costingStandard:read" as Permission,
  batch: "costingBatch:read" as Permission,
  variance: "costingVariance:read" as Permission,
  reports: "costingReports:read" as Permission,
};

const standardWorkflow = [
  COMMON_COSTING_ACTIONS.submit,
  COMMON_COSTING_ACTIONS.approve,
  COMMON_COSTING_ACTIONS.reject,
  COMMON_COSTING_ACTIONS.finalize,
  COMMON_COSTING_ACTIONS.reopen,
];

const batchWorkflow = [
  COMMON_COSTING_ACTIONS.submit,
  COMMON_COSTING_ACTIONS.approve,
  COMMON_COSTING_ACTIONS.reject,
  COMMON_COSTING_ACTIONS.finalize,
  COMMON_COSTING_ACTIONS.reopen,
  COMMON_COSTING_ACTIONS.recalculate,
  COMMON_COSTING_ACTIONS.reconcile,
];

export function ProductStandardList() {
  return (
    <CostingList
      title="Product standard costs"
      description="Standard costs by product and BOM revision with approval workflow."
      resource="standards"
      permission={P.standard}
      createHref="/costing/standards/new"
      createLabel="New standard"
      exportColumns={["standardNumber", "productId", "bomId", "status", "totalBatchCost", "costPerUnit"]}
      columns={[
        { key: "standardNumber", header: "Standard #" },
        { key: "productId", header: "Product" },
        { key: "bomId", header: "BOM", hideOnMobile: true },
        { key: "status", header: "Status" },
        { key: "totalBatchCost", header: "Batch cost", hideOnMobile: true },
        { key: "costPerUnit", header: "Unit cost", hideOnMobile: true },
      ]}
      rowHref={(row) => `/costing/standards/${row.id}`}
    />
  );
}

export function BatchCostingList() {
  return (
    <CostingList
      title="Batch costing"
      description="Actual batch costs built from manufacturing orders and source transactions."
      resource="batches"
      permission={P.batch}
      createHref="/costing/batches/new"
      createLabel="New batch costing"
      exportColumns={["batchCostingNumber", "productId", "batchNumber", "status", "totalBatchCost", "costPerUnit"]}
      columns={[
        { key: "batchCostingNumber", header: "Costing #" },
        { key: "productId", header: "Product" },
        { key: "batchNumber", header: "Batch", hideOnMobile: true },
        { key: "status", header: "Status" },
        { key: "totalBatchCost", header: "Total", hideOnMobile: true },
        { key: "costPerUnit", header: "Unit", hideOnMobile: true },
      ]}
      rowHref={(row) => `/costing/batches/${row.id}`}
    />
  );
}

export function RateCardList() {
  return (
    <CostingList
      title="Rate cards"
      description="Labor, machine, overhead, and material standard rates."
      resource="rateCards"
      permission={P.costing}
      createHref="/costing/rate-cards/new"
      createLabel="New rate card"
      exportColumns={["rateCardNumber", "name", "rateType", "rate", "uom", "status"]}
      columns={[
        { key: "rateCardNumber", header: "Number" },
        { key: "name", header: "Name" },
        { key: "rateType", header: "Type", hideOnMobile: true },
        { key: "rate", header: "Rate" },
        { key: "status", header: "Status", hideOnMobile: true },
      ]}
      rowHref={() => "/costing/rate-cards"}
    />
  );
}

export function AllocationRuleList() {
  return (
    <CostingList
      title="Allocation rules"
      description="Overhead pools and absorption bases for batch costing."
      resource="allocationRules"
      permission={P.costing}
      createHref="/costing/allocation-rules/new"
      createLabel="New rule"
      exportColumns={["ruleNumber", "name", "allocationBasis", "costPoolAmount", "status"]}
      columns={[
        { key: "ruleNumber", header: "Rule #" },
        { key: "name", header: "Name" },
        { key: "allocationBasis", header: "Basis", hideOnMobile: true },
        { key: "costPoolAmount", header: "Pool" },
        { key: "status", header: "Status", hideOnMobile: true },
      ]}
      rowHref={() => "/costing/allocation-rules"}
    />
  );
}

export function VarianceList() {
  return (
    <CostingList
      title="Variance analyses"
      description="Standard vs actual variance breakdown by batch."
      resource="variances"
      permission={P.variance}
      exportColumns={["varianceNumber", "batchCostingId", "varianceType", "amount", "status"]}
      columns={[
        { key: "varianceNumber", header: "Variance #" },
        { key: "batchCostingId", header: "Batch costing" },
        { key: "varianceType", header: "Type", hideOnMobile: true },
        { key: "amount", header: "Amount" },
        { key: "status", header: "Status", hideOnMobile: true },
      ]}
      rowHref={(row) =>
        row.batchCostingId ? `/costing/batches/${String(row.batchCostingId)}` : "/costing/variances"
      }
    />
  );
}

export function InvestigationList() {
  return (
    <CostingList
      title="Variance investigations"
      description="Documented root-cause reviews for significant variances."
      resource="investigations"
      permission={P.variance}
      exportColumns={["investigationNumber", "batchCostingId", "varianceType", "amount", "status"]}
      columns={[
        { key: "investigationNumber", header: "Investigation #" },
        { key: "batchCostingId", header: "Batch" },
        { key: "varianceType", header: "Type", hideOnMobile: true },
        { key: "amount", header: "Amount" },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) =>
        row.batchCostingId ? `/costing/batches/${String(row.batchCostingId)}` : "/costing/variances"
      }
    />
  );
}

export function MaterialCostOverview() {
  return <CostingReportsPage defaultType="material_cost" />;
}

export function PackagingCostOverview() {
  return <CostingReportsPage defaultType="packaging_cost" />;
}

export function LaborCostOverview() {
  return <CostingReportsPage defaultType="labor_cost" />;
}

export function MachineCostOverview() {
  return <CostingReportsPage defaultType="machine_cost" />;
}

export function OverheadCostOverview() {
  return <CostingReportsPage defaultType="overhead_allocation" />;
}

export function YieldWastageOverview() {
  return <CostingReportsPage defaultType="yield_wastage" />;
}

export function ReworkCostOverview() {
  return <CostingReportsPage defaultType="rework_cost" />;
}

export function QualityCostOverview() {
  return <CostingReportsPage defaultType="quality_cost" />;
}

export function CostCenterOverview() {
  return <CostingReportsPage defaultType="cost_center" />;
}

export function ProductProfitabilityOverview() {
  return <CostingReportsPage defaultType="product_profitability" />;
}

export function CustomerProfitabilityOverview() {
  return <CostingReportsPage defaultType="customer_profitability" />;
}

export function CmoCostingOverview() {
  return <CostingReportsPage defaultType="cmo_costing" />;
}

export function ProductStandardDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission={P.standard}
      resource="standards"
      id={id}
      titleKey="standardNumber"
      actions={standardWorkflow}
    >
      {({ record, extra }) => (
        <RecordSections
          record={record}
          fields={[
            "productId",
            "bomId",
            "bomVersion",
            "standardBatchSize",
            "materialCost",
            "packagingCost",
            "laborCost",
            "machineCost",
            "overheadCost",
            "totalBatchCost",
            "costPerUnit",
            "dataQuality",
            "methodologyVersion",
          ]}
          items={(extra.versions as Row[]) || []}
          itemColumns={["versionId", "status", "totalBatchCost", "createdAt"]}
        />
      )}
    </DetailShell>
  );
}

export function BatchCostingDetail({ id }: { id: string }) {
  return (
    <DetailShell permission={P.batch} resource="batches" id={id} titleKey="batchCostingNumber" actions={batchWorkflow}>
      {({ record, extra }) => (
        <div className="space-y-6">
          <RecordSections
            record={record}
            fields={[
              "productId",
              "batchNumber",
              "manufacturingOrderId",
              "productStandardId",
              "outputQuantity",
              "completenessStatus",
              "dataQuality",
              "varianceExplanation",
              "currency",
            ]}
          />
          <BreakdownPanel record={record} />
          <LinesPanel lines={(extra.lines as Row[]) || []} />
          <VariancesPanel variances={(extra.variances as Row[]) || []} />
          <InvestigationsPanel rows={(extra.investigations as Row[]) || []} batchId={id} />
        </div>
      )}
    </DetailShell>
  );
}

function DetailShell({
  permission,
  resource,
  id,
  titleKey,
  actions,
  children,
}: {
  permission: Permission;
  resource: string;
  id: string;
  titleKey: string;
  actions: Parameters<typeof CostingWorkflowActions>[0]["actions"];
  children?: (ctx: { record: Row; extra: Record<string, unknown>; reload: () => void }) => ReactNode;
}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  function load() {
    void getCosting(resource, id)
      .then((result) => {
        setRecord(result.record as Row);
        setExtra(result.extra || {});
        setError(null);
      })
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) {
    return <EmptyState title="Unable to load record" description={error || "Not found."} />;
  }

  return (
    <RequirePermission permission={permission}>
      <div>
        <PageHeader
          title={String(record[titleKey] || record.id)}
          description="Costing record with audited workflow actions."
        />
        <CostingWorkflowActions
          resource={resource}
          id={id}
          status={String(record.status || "")}
          statusOptions={costingStatusOptions}
          actions={actions}
          onChanged={load}
        />
        {children?.({ record, extra, reload: load })}
      </div>
    </RequirePermission>
  );
}

function BreakdownPanel({ record }: { record: Row }) {
  const fields = [
    "materialCost",
    "packagingCost",
    "laborCost",
    "machineCost",
    "overheadCost",
    "qualityCost",
    "reworkCost",
    "wastageCost",
    "otherCost",
    "credits",
    "totalBatchCost",
    "costPerUnit",
  ];
  return (
    <div className="rounded-xl border p-4">
      <p className="mb-3 text-sm font-medium">Cost breakdown</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <div key={field}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{field}</p>
            <p className="mt-1 text-sm font-medium tabular-nums">{formatValue(record[field])}</p>
          </div>
        ))}
      </div>
      {Array.isArray(record.missingComponents) && record.missingComponents.length ? (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
          Missing components: {record.missingComponents.join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function LinesPanel({ lines }: { lines: Row[] }) {
  if (!lines.length) {
    return (
      <p className="text-sm text-muted-foreground">No cost lines returned yet. Recalculate after source data is complete.</p>
    );
  }
  const columns = ["componentType", "description", "quantity", "uom", "unitCost", "totalCost", "dataQuality"];
  return (
    <div className="rounded-xl border">
      <div className="border-b px-4 py-3 text-sm font-medium">Cost lines</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {columns.map((column) => (
                <th key={column} className="px-4 py-2 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={String(line.id || index)} className="border-b last:border-0">
                {columns.map((column) => (
                  <td key={column} className="px-4 py-2">
                    {formatValue(line[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VariancesPanel({ variances }: { variances: Row[] }) {
  if (!variances.length) return null;
  return (
    <div className="rounded-xl border p-4">
      <p className="mb-3 text-sm font-medium">Variance analyses</p>
      <ul className="space-y-2 text-sm">
        {variances.map((row) => (
          <li key={String(row.id)} className="rounded-lg bg-muted/40 px-3 py-2">
            {formatValue(row.varianceType)} · {formatValue(row.amount)} · {formatValue(row.status)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InvestigationsPanel({ rows, batchId }: { rows: Row[]; batchId: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Investigations</p>
        <Link href={`/costing/variances`} className="text-sm text-primary underline-offset-4 hover:underline">
          View all variances
        </Link>
      </div>
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">No investigations linked to batch {batchId}.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li key={String(row.id)} className="rounded-lg bg-muted/40 px-3 py-2">
              {formatValue(row.investigationNumber || row.id)} · {formatValue(row.varianceType)} ·{" "}
              {formatValue(row.explanation)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecordSections({
  record,
  fields,
  items = [],
  itemColumns = ["componentType", "description", "quantity", "unitCost", "totalCost"],
}: {
  record: Row;
  fields: string[];
  items?: Row[];
  itemColumns?: string[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <div key={field}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{field}</p>
            <p className="mt-1 text-sm font-medium break-all">{formatValue(record[field])}</p>
          </div>
        ))}
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">status</p>
          <div className="mt-1">
            <StatusBadge
              label={labelFor(costingStatusOptions, String(record.status || ""))}
              tone={workflowTone(String(record.status || ""))}
            />
          </div>
        </div>
      </div>
      {items.length ? (
        <div className="rounded-xl border">
          <div className="border-b px-4 py-3 text-sm font-medium">Versions / related</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {itemColumns.map((column) => (
                    <th key={column} className="px-4 py-2 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={String(item.id || item.versionId)} className="border-b last:border-0">
                    {itemColumns.map((column) => (
                      <td key={column} className="px-4 py-2">
                        {formatValue(item[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
