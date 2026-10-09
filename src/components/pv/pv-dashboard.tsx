"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPvDashboard } from "@/lib/pv/client";
import { publicMasterError } from "@/lib/masters/errors";

const COLORS = ["#0f766e", "#0369a1", "#b45309", "#be123c", "#6d28d9", "#334155"];

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
    <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{Number(value || 0)}</p>
    </Link>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="h-64">{children}</CardContent>
    </Card>
  );
}

function toChart(map?: Record<string, number>) {
  return Object.entries(map || {}).map(([name, value]) => ({ name: name || "—", value: Number(value || 0) }));
}

function BarBlock({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No posted PV data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" hide={data.length > 8} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#0f766e" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieBlock({ data, empty }: { data: Array<{ name: string; value: number }>; empty: string }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
