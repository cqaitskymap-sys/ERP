"use client";

import { BarBlock, ChartCard, PieBlock, toChart } from "@/components/charts/dashboard-charts";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { getQcDashboard } from "@/lib/qc/client";
import { publicMasterError } from "@/lib/masters/errors";

export function QcDashboard() {
  return (
    <RequirePermission permission="qc:read">
      <DashboardInner />
    </RequirePermission>
  );
}

function DashboardInner() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getQcDashboard()
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!stats && !error) return <LoadingState variant="page" />;
  if (error || !stats) {
    return <EmptyState title="Unable to load QC metrics" description={error || "Try again after signing in."} />;
  }

  const kpis = (stats.kpis || {}) as Record<string, number>;
  const charts = (stats.charts || {}) as Record<string, Record<string, number>>;

  return (
    <div>
      <PageHeader
        title="Quality Control dashboard"
        description="Live sample, test, OOS, COA, and turnaround metrics from Firestore. QA batch release is not performed here."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/qc/sample-requests/new">New sample request</Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/qc/tests">Open workbench</Link>
            </Button>
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Samples pending" value={kpis.samplesPending} href="/qc/samples" />
        <Metric label="Samples received" value={kpis.samplesReceived} href="/qc/samples" />
        <Metric label="Tests pending" value={kpis.testsPending} href="/qc/tests" />
        <Metric label="Tests in progress" value={kpis.testsInProgress} href="/qc/tests" />
        <Metric label="Tests completed" value={kpis.testsCompleted} href="/qc/results" />
        <Metric label="OOS open" value={kpis.oosOpen} href="/qc/oos" />
        <Metric label="OOT open" value={kpis.ootOpen} href="/qc/oot" />
        <Metric label="Retests pending" value={kpis.retestsPending} href="/qc/retests" />
        <Metric label="COA pending" value={kpis.coaPending} href="/qc/coa" />
        <Metric label="QC review pending" value={kpis.reviewPending} href="/qc/tests" />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric label="Average TAT (hours)" value={kpis.averageTatHours} href="/qc/reports" />
        <Metric label="Minimum TAT (hours)" value={kpis.minTatHours} href="/qc/reports" />
        <Metric label="Maximum TAT (hours)" value={kpis.maxTatHours} href="/qc/reports" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Test status">
          <PieBlock data={toChart(charts.byStatus)} empty="No laboratory tests posted yet." />
        </ChartCard>
        <ChartCard title="Pass vs fail">
          <PieBlock data={toChart(charts.passFail)} empty="No evaluated results yet." />
        </ChartCard>
        <ChartCard title="OOS trend">
          <BarBlock data={toChart(charts.oosTrend)} />
        </ChartCard>
        <ChartCard title="Tests by material">
          <BarBlock data={toChart(charts.byMaterial)} />
        </ChartCard>
        <ChartCard title="Tests by product">
          <BarBlock data={toChart(charts.byProduct)} />
        </ChartCard>
        <ChartCard title="Tests by customer">
          <BarBlock data={toChart(charts.byCustomer)} />
        </ChartCard>
        <ChartCard title="Analyst workload">
          <BarBlock data={toChart(charts.byAnalyst)} />
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
