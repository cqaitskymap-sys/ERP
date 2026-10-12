"use client";

import { BarBlock, ChartCard, PieBlock, toChart } from "@/components/charts/dashboard-charts";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { getProductionDashboard } from "@/lib/production/client";
import { publicMasterError } from "@/lib/masters/errors";

export function ProductionDashboard() {
  return (
    <RequirePermission permission="production:read">
      <DashboardInner />
    </RequirePermission>
  );
}

function DashboardInner() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getProductionDashboard()
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!stats && !error) return <LoadingState variant="page" />;
  if (error || !stats) {
    return <EmptyState title="Unable to load production metrics" description={error || "Try again after signing in."} />;
  }

  const kpis = (stats.kpis || {}) as Record<string, number>;
  const charts = (stats.charts || {}) as Record<string, Record<string, number>>;

  return (
    <div>
      <PageHeader
        title="Production dashboard"
        description="Live planned, scheduled, in-progress, shortage, and yield metrics from Firestore."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/production/plans/new">New plan</Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/production/orders/new">New batch</Link>
            </Button>
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Planned batches" value={kpis.plannedBatches} href="/production/orders" />
        <Metric label="Scheduled batches" value={kpis.scheduledBatches} href="/production/schedule" />
        <Metric label="In progress" value={kpis.inProgress} href="/production/orders" />
        <Metric label="Completed" value={kpis.completed} href="/production/orders" />
        <Metric label="QC pending" value={kpis.qcPending} href="/production/orders" />
        <Metric label="QA pending" value={kpis.qaPending} href="/production/orders" />
        <Metric label="Material shortage" value={kpis.materialShortage} href="/production/materials" />
        <Metric label="Delayed batches" value={kpis.delayedBatches} href="/production/reports" />
        <Metric label="Low yield batches" value={kpis.lowYieldBatches} href="/production/yield" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Production by product">
          <BarBlock data={toChart(charts.byProduct)} />
        </ChartCard>
        <ChartCard title="Production by customer">
          <BarBlock data={toChart(charts.byCustomer)} />
        </ChartCard>
        <ChartCard title="Batch status">
          <PieBlock data={toChart(charts.byStatus)} />
        </ChartCard>
        <ChartCard title="Production trend">
          <BarBlock data={toChart(charts.trend)} />
        </ChartCard>
        <ChartCard title="Work center utilization">
          <BarBlock data={toChart(charts.workCenter)} />
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
