"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCostingDashboard } from "@/lib/costing/client";
import { publicMasterError } from "@/lib/masters/errors";

type Row = Record<string, unknown>;

export function CostingDashboard() {
  return (
    <RequirePermission permission="costing:read">
      <DashboardInner />
    </RequirePermission>
  );
}

function DashboardInner() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "", productId: "", batchNumber: "" });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getCostingDashboard(filters)
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [filters]);

  if (!stats && !error) return <LoadingState variant="page" />;
  if (error) {
    return <EmptyState title="Unable to load costing metrics" description={error} />;
  }
  if (!stats) {
    return <EmptyState title="Costing dashboard unavailable" description="Try again after signing in." />;
  }

  const kpis = (stats.kpis || {}) as Record<string, number | null>;
  const note = stats.note ? String(stats.note) : null;
  const highestVariance = (stats.highestVarianceProducts || []) as Row[];
  const incomplete = (stats.incompleteRecords || []) as Row[];
  const pending = (stats.pendingApprovals || []) as Row[];
  const metricEntries = Object.entries(kpis).filter(([, value]) => value != null);

  return (
    <div>
      <PageHeader
        title="Manufacturing costing"
        description="Batch costs, standards, variances, and approvals from live production costing records."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/costing/batches/new">New batch costing</Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/costing/standards/new">New product standard</Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Input
          className="min-h-11"
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
        />
        <Input
          className="min-h-11"
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
        />
        <Input
          className="min-h-11"
          placeholder="Product ID"
          value={filters.productId}
          onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
        />
        <Input
          className="min-h-11"
          placeholder="Batch number"
          value={filters.batchNumber}
          onChange={(e) => setFilters({ ...filters, batchNumber: e.target.value })}
        />
      </div>
      {note ? (
        <p className="mb-4 rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">{note}</p>
      ) : null}
      {metricEntries.length ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricEntries.map(([key, value]) => (
            <Metric key={key} label={humanizeKey(key)} value={value} href={kpiHref(key)} />
          ))}
        </div>
      ) : (
        <p className="mb-6 text-sm text-muted-foreground">No KPI aggregates returned for the selected filters.</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <TableCard
          title="Highest variance batches"
          rows={highestVariance}
          columns={["batchNumber", "productId", "variance", "unexplained"]}
          rowHref={(row) => (row.id ? `/costing/batches/${row.id}` : undefined)}
        />
        <TableCard
          title="Incomplete cost records"
          rows={incomplete}
          columns={["batchCostingNumber", "status", "missingComponents"]}
          rowHref={(row) => (row.id ? `/costing/batches/${row.id}` : undefined)}
        />
        <TableCard
          title="Pending approvals"
          rows={pending}
          columns={["batchCostingNumber", "productId", "status"]}
          rowHref={(row) => (row.id ? `/costing/batches/${row.id}` : undefined)}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, href }: { label: string; value?: number | null; href: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{formatMetric(value)}</p>
    </Link>
  );
}

function formatMetric(value?: number | null) {
  if (value == null) return "—";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function TableCard({
  title,
  rows,
  columns,
  rowHref,
}: {
  title: string;
  rows: Row[];
  columns: string[];
  rowHref?: (row: Row) => string | undefined;
}) {
  const router = useRouter();
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b px-4 py-3 text-sm font-medium">{title}</div>
      {!rows.length ? (
        <p className="p-4 text-sm text-muted-foreground">No rows for the selected filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {columns.map((column) => (
                  <th key={column} className="px-4 py-2 font-medium">
                    {humanizeKey(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 12).map((row, index) => {
                const href = rowHref?.(row);
                return (
                  <tr
                    key={String(row.id || index)}
                    className={`border-b last:border-0 ${href ? "cursor-pointer hover:bg-muted/40" : ""}`}
                    onClick={href ? () => router.push(href) : undefined}
                  >
                    {columns.map((column) => (
                      <td key={column} className="px-4 py-2">
                        {formatCell(row[column])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatCell(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(value);
}

function humanizeKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function kpiHref(key: string) {
  if (key.includes("Approval")) return "/costing/approvals";
  if (key.includes("Incomplete")) return "/costing/audit";
  if (key.includes("Variance") || key.includes("standardVersus")) return "/costing/variances";
  if (key.includes("material")) return "/costing/materials";
  if (key.includes("packaging")) return "/costing/packaging";
  if (key.includes("labor")) return "/costing/labor";
  if (key.includes("overhead")) return "/costing/overheads";
  if (key.includes("Reconciliation")) return "/costing/reports?type=ledger_reconciliation";
  return "/costing/reports";
}
