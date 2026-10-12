"use client";

import { BarBlock, ChartCard, PieBlock, toChart } from "@/components/charts/dashboard-charts";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { getProcurementDashboard } from "@/lib/procurement/client";
import { publicMasterError } from "@/lib/masters/errors";

export function ProcurementDashboard() {
  return (
    <RequirePermission permission="procurement:read">
      <DashboardInner />
    </RequirePermission>
  );
}

function DashboardInner() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getProcurementDashboard()
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!stats && !error) return <LoadingState variant="page" />;
  if (error || !stats) {
    return <EmptyState title="Unable to load procurement metrics" description={error || "Try again after signing in."} />;
  }

  const kpis = (stats.kpis || {}) as Record<string, number>;
  const charts = (stats.charts || {}) as Record<string, Record<string, number>>;

  return (
    <div>
      <PageHeader
        title="Procurement dashboard"
        description="Live requisition, RFQ, quotation, and purchase-order metrics from Firestore."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/procurement/requisitions/new">New PR</Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/procurement/orders/new">New PO</Link>
            </Button>
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Open PRs" value={kpis.openPrs} href="/procurement/requisitions" />
        <Metric label="Pending approvals" value={kpis.pendingApprovals} href="/procurement/approvals" />
        <Metric label="Active RFQs" value={kpis.activeRfqs} href="/procurement/rfqs" />
        <Metric label="Quotations pending" value={kpis.quotationsPending} href="/procurement/quotations" />
        <Metric label="POs pending approval" value={kpis.posPendingApproval} href="/procurement/orders" />
        <Metric label="Open POs" value={kpis.openPos} href="/procurement/orders" />
        <Metric label="Partially received" value={kpis.partiallyReceived} href="/procurement/orders" />
        <Metric label="Overdue deliveries" value={kpis.overdueDeliveries} href="/procurement/reports" />
        <Metric label="Completed POs" value={kpis.completedPos} href="/procurement/orders" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Purchase by vendor">
          <BarBlock data={toChart(charts.byVendor)} />
        </ChartCard>
        <ChartCard title="PO status">
          <PieBlock data={toChart(charts.byStatus)} />
        </ChartCard>
        <ChartCard title="Monthly purchase value">
          <BarBlock data={toChart(charts.monthly)} />
        </ChartCard>
        <ChartCard title="Delivery performance">
          <BarBlock data={toChart((charts.deliveryPerformance || {}) as Record<string, number>)} />
        </ChartCard>
      </div>
    </div>
  );
}

function Metric({ label, value, href }: { label: string; value?: number; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_16px_32px_-24px_color-mix(in_oklch,var(--primary)_70%,transparent)]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{Number(value || 0)}</p>
    </Link>
  );
}
