"use client";

import { BarBlock, ChartCard, PieBlock, toChart } from "@/components/charts/dashboard-charts";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { getRaDashboard } from "@/lib/ra/client";
import { publicMasterError } from "@/lib/masters/errors";

export function RaDashboard() {
  return (
    <RequirePermission permission="ra:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getRaDashboard()
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!stats && !error) return <LoadingState variant="page" />;
  if (error || !stats) return <EmptyState title="Unable to load RA metrics" description={error || "Try again after signing in."} />;

  const kpis = (stats.kpis || {}) as Record<string, number>;
  const charts = (stats.charts || {}) as Record<string, Record<string, number>>;

  return (
    <div>
      <PageHeader
        title="Regulatory Affairs dashboard"
        description="Live registration, submission, query, and expiry metrics from Firestore. This is not an authority certification."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/ra/registrations/new">New registration</Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/ra/calendar">Compliance calendar</Link>
            </Button>
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Active registrations" value={kpis.activeRegistrations} href="/ra/registrations" />
        <Metric label="Pending submissions" value={kpis.pendingSubmissions} href="/ra/submissions" />
        <Metric label="Under authority review" value={kpis.underAuthorityReview} href="/ra/submissions" />
        <Metric label="Approved registrations" value={kpis.approvedRegistrations} href="/ra/registrations" />
        <Metric label="Expiring registrations" value={kpis.expiringRegistrations} href="/ra/renewals" />
        <Metric label="Expiring licenses" value={kpis.expiringLicenses} href="/ra/licenses" />
        <Metric label="Open queries" value={kpis.openQueries} href="/ra/queries" />
        <Metric label="Open commitments" value={kpis.openCommitments} href="/ra/commitments" />
        <Metric label="Overdue commitments" value={kpis.overdueCommitments} href="/ra/commitments" />
        <Metric label="Documents expiring" value={kpis.documentsExpiring} href="/ra/documents" />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric label="Average submission TAT (hours)" value={kpis.averageTatHours} href="/ra/reports" />
        <Metric label="Minimum TAT (hours)" value={kpis.minTatHours} href="/ra/reports" />
        <Metric label="Maximum TAT (hours)" value={kpis.maxTatHours} href="/ra/reports" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Registration status"><PieBlock data={toChart(charts.byStatus)} empty="No registrations posted yet." /></ChartCard>
        <ChartCard title="Submission status"><PieBlock data={toChart(charts.submissionStatus)} empty="No submissions posted yet." /></ChartCard>
        <ChartCard title="Registration by market"><BarBlock data={toChart(charts.byMarket)} /></ChartCard>
        <ChartCard title="Registration by product"><BarBlock data={toChart(charts.byProduct)} /></ChartCard>
        <ChartCard title="Upcoming renewals"><BarBlock data={toChart(charts.upcoming)} /></ChartCard>
        <ChartCard title="Authority query trend"><BarBlock data={toChart(charts.queryTrend)} /></ChartCard>
        <ChartCard title="Commitment status"><PieBlock data={toChart(charts.commitmentStatus)} empty="No commitments yet." /></ChartCard>
        <ChartCard title="Regulatory workload"><BarBlock data={toChart(charts.workload)} /></ChartCard>
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
