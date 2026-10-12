"use client";

import { BarBlock, ChartCard, PieBlock, toChart } from "@/components/charts/dashboard-charts";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { getPvDashboard } from "@/lib/pv/client";
import { publicMasterError } from "@/lib/masters/errors";

export function PvDashboard() {
  return (
    <RequirePermission permission="pv:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getPvDashboard()
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!stats && !error) return <LoadingState variant="page" />;
  if (error || !stats) return <EmptyState title="Unable to load PV metrics" description={error || "Try again after signing in."} />;

  const kpis = (stats.kpis || {}) as Record<string, number>;
  const charts = (stats.charts || {}) as Record<string, Record<string, number>>;

  return (
    <div>
      <PageHeader
        title="Pharmacovigilance dashboard"
        description="Live case, follow-up, reporting, and signal metrics from Firestore. Patient identifiers are not shown here. This is not a medical decision system."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11"><Link href="/pv/intake/new">New intake</Link></Button>
            <Button asChild className="min-h-11"><Link href="/pv/cases/new">New case</Link></Button>
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="New safety cases" value={kpis.newSafetyCases} href="/pv/cases" />
        <Metric label="Cases under triage" value={kpis.casesUnderTriage} href="/pv/cases" />
        <Metric label="Cases under review" value={kpis.casesUnderReview} href="/pv/medical-review" />
        <Metric label="Serious cases" value={kpis.seriousCases} href="/pv/cases" />
        <Metric label="Critical cases" value={kpis.criticalCases} href="/pv/cases" />
        <Metric label="Follow-ups pending" value={kpis.followUpsPending} href="/pv/follow-ups" />
        <Metric label="Overdue follow-ups" value={kpis.overdueFollowUps} href="/pv/follow-ups" />
        <Metric label="Reports pending" value={kpis.regulatoryReportsPending} href="/pv/regulatory-reports" />
        <Metric label="Reports submitted" value={kpis.reportsSubmitted} href="/pv/regulatory-reports" />
        <Metric label="Open signals" value={kpis.openSignals} href="/pv/signals" />
        <Metric label="Open commitments" value={kpis.openCommitments} href="/pv/commitments" />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric label="Average case TAT (hours)" value={kpis.averageTatHours} href="/pv/reports" />
        <Metric label="Minimum TAT (hours)" value={kpis.minTatHours} href="/pv/reports" />
        <Metric label="Maximum TAT (hours)" value={kpis.maxTatHours} href="/pv/reports" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Cases by month"><BarBlock data={toChart(charts.byMonth)} /></ChartCard>
        <ChartCard title="Cases by seriousness"><PieBlock data={toChart(charts.bySeriousness)} empty="No seriousness assessments yet." /></ChartCard>
        <ChartCard title="Cases by product"><BarBlock data={toChart(charts.byProduct)} /></ChartCard>
        <ChartCard title="Cases by market"><BarBlock data={toChart(charts.byMarket)} /></ChartCard>
        <ChartCard title="Cases by source"><PieBlock data={toChart(charts.bySource)} empty="No cases posted yet." /></ChartCard>
        <ChartCard title="Cases by event category"><BarBlock data={toChart(charts.byEvent)} /></ChartCard>
        <ChartCard title="Follow-up status"><PieBlock data={toChart(charts.followUpStatus)} empty="No follow-ups yet." /></ChartCard>
        <ChartCard title="Regulatory reporting status"><BarBlock data={toChart(charts.reportStatus)} /></ChartCard>
        <ChartCard title="Signal trend"><BarBlock data={toChart(charts.signalTrend)} /></ChartCard>
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
