"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFinanceDashboard } from "@/lib/finance/client";
import { publicMasterError } from "@/lib/masters/errors";

type Row = Record<string, unknown>;

export function FinanceDashboard() {
  return (
    <RequirePermission permission="finance:read">
      <DashboardInner />
    </RequirePermission>
  );
}

function DashboardInner() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "", periodId: "" });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getFinanceDashboard(filters)
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [filters.from, filters.to, filters.periodId]);

  if (!stats && !error) return <LoadingState variant="page" />;
  if (error || !stats) {
    return <EmptyState title="Unable to load finance metrics" description={error || "Try again after signing in."} />;
  }

  const kpis = (stats.kpis || {}) as Record<string, number | null>;
  const supplierAging = (stats.supplierAging || {}) as Record<string, number>;
  const customerAging = (stats.customerAging || {}) as Record<string, number>;
  const aging = [
    ...Object.entries(supplierAging).map(([bucket, amount]) => ({
      id: `ap-${bucket}`,
      partnerName: "AP",
      documentNumber: bucket,
      dueDate: "—",
      balance: amount,
      bucket,
    })),
    ...Object.entries(customerAging).map(([bucket, amount]) => ({
      id: `ar-${bucket}`,
      partnerName: "AR",
      documentNumber: bucket,
      dueDate: "—",
      balance: amount,
      bucket,
    })),
  ] as Row[];
  const upcoming = ((stats.upcomingDue || stats.upcomingPayments || []) as Row[]).map((row) => ({
    ...row,
    paymentNumber: row.documentNumber || row.paymentNumber,
    beneficiary: row.partyId || row.beneficiary,
    amount: row.outstandingBalance ?? row.amount,
    status: row.type || row.status,
  }));

  const metricEntries = Object.entries(kpis).filter(([, value]) => value != null);

  return (
    <div>
      <PageHeader
        title="Finance dashboard"
        description="Ledger, payables, receivables, and cash metrics from live finance records."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/finance/journals/new">New journal</Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/finance/supplier-invoices/new">New supplier invoice</Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
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
          placeholder="Period ID"
          value={filters.periodId}
          onChange={(e) => setFilters({ ...filters, periodId: e.target.value })}
        />
      </div>
      {metricEntries.length ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricEntries.map(([key, value]) => (
            <Metric key={key} label={humanizeKey(key)} value={value} href={kpiHref(key)} />
          ))}
        </div>
      ) : (
        <p className="mb-6 text-sm text-muted-foreground">No KPI aggregates returned yet.</p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <TableCard title="AP / AR aging" rows={aging} columns={["partnerName", "documentNumber", "dueDate", "balance", "bucket"]} />
        <TableCard
          title="Upcoming payments"
          rows={upcoming}
          columns={["paymentNumber", "beneficiary", "dueDate", "amount", "status"]}
        />
      </div>
    </div>
  );
}

function Metric({ label, value, href }: { label: string; value?: number | null; href: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{Number(value || 0).toLocaleString()}</p>
    </Link>
  );
}

function TableCard({ title, rows, columns }: { title: string; rows: Row[]; columns: string[] }) {
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
              {rows.slice(0, 12).map((row, index) => (
                <tr key={String(row.id || index)} className="border-b last:border-0">
                  {columns.map((column) => (
                    <td key={column} className="px-4 py-2">
                      {String(row[column] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function humanizeKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function kpiHref(key: string) {
  if (key.includes("Ap") || key.includes("Payable")) return "/finance/ap";
  if (key.includes("Ar") || key.includes("Receivable")) return "/finance/ar";
  if (key.includes("Journal")) return "/finance/journals";
  if (key.includes("Payment")) return "/finance/payments";
  if (key.includes("Approval")) return "/finance/approvals";
  return "/finance/reports";
}
