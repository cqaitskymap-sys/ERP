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
import { getComplaintDashboard } from "@/lib/complaints/client";
import { publicMasterError } from "@/lib/masters/errors";

const COLORS = ["#0f766e", "#0369a1", "#b45309", "#be123c", "#6d28d9", "#334155"];

export function ComplaintDashboard() {
  return (
    <RequirePermission permission="complaints:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getComplaintDashboard()
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!stats && !error) return <LoadingState />;
  if (error || !stats) return <EmptyState title="Unable to load complaint metrics" description={error || "Try again after signing in."} />;

  const kpis = (stats.kpis || {}) as Record<string, number>;
  const charts = (stats.charts || {}) as Record<string, Record<string, number>>;

  return (
    <div>
      <PageHeader
        title="Complaints & market feedback"
        description="Live complaint, investigation, CAPA, and recall metrics from Firestore. The system does not autonomously decide recall, root cause, or regulatory submission."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11"><Link href="/complaints/intake">New intake</Link></Button>
            <Button asChild className="min-h-11"><Link href="/complaints/recalls/new">New recall assessment</Link></Button>
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total complaints" value={kpis.totalComplaints} href="/complaints/cases" />
        <Metric label="New complaints" value={kpis.newComplaints} href="/complaints/cases" />
        <Metric label="Under triage" value={kpis.underTriage} href="/complaints/cases" />
        <Metric label="Under investigation" value={kpis.underInvestigation} href="/complaints/investigations" />
        <Metric label="High risk" value={kpis.highRiskComplaints} href="/complaints/cases" />
        <Metric label="Critical complaints" value={kpis.criticalComplaints} href="/complaints/cases" />
        <Metric label="Overdue complaints" value={kpis.overdueComplaints} href="/complaints/reports" />
        <Metric label="Pending QA decisions" value={kpis.pendingQaDecisions} href="/complaints/cases" />
        <Metric label="CAPA required" value={kpis.capaRequired} href="/qa/capa" />
        <Metric label="Recall required" value={kpis.recallRequired} href="/complaints/recalls" />
        <Metric label="Open recalls" value={kpis.openRecalls} href="/complaints/recalls" />
        <Metric label="Closed complaints" value={kpis.closedComplaints} href="/complaints/cases" />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric label="Average TAT (hours)" value={kpis.averageTatHours} href="/complaints/reports" />
        <Metric label="Minimum TAT (hours)" value={kpis.minTatHours} href="/complaints/reports" />
        <Metric label="Maximum TAT (hours)" value={kpis.maxTatHours} href="/complaints/reports" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Complaints by month"><BarBlock data={toChart(charts.byMonth)} /></ChartCard>
        <ChartCard title="Complaints by product"><BarBlock data={toChart(charts.byProduct)} /></ChartCard>
        <ChartCard title="Complaints by batch"><BarBlock data={toChart(charts.byBatch)} /></ChartCard>
        <ChartCard title="Complaints by customer"><BarBlock data={toChart(charts.byCustomer)} /></ChartCard>
        <ChartCard title="Complaints by market"><BarBlock data={toChart(charts.byMarket)} /></ChartCard>
        <ChartCard title="Complaints by category"><PieBlock data={toChart(charts.byCategory)} empty="No classifications yet." /></ChartCard>
        <ChartCard title="Complaints by severity"><PieBlock data={toChart(charts.bySeverity)} empty="No severity assigned yet." /></ChartCard>
        <ChartCard title="Complaints by status"><BarBlock data={toChart(charts.byStatus)} /></ChartCard>
        <ChartCard title="Root cause distribution"><BarBlock data={toChart(charts.rootCauses)} /></ChartCard>
        <ChartCard title="CAPA trend"><BarBlock data={toChart(charts.capaTrend)} /></ChartCard>
        <ChartCard title="Recall trend"><BarBlock data={toChart(charts.recallTrend)} /></ChartCard>
      </div>
    </div>
  );
}

function Metric({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-card p-4 transition hover:border-primary/40">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{Number(value || 0)}</p>
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

function toChart(map: Record<string, number> | undefined) {
  return Object.entries(map || {}).map(([name, value]) => ({ name, value }));
}

function BarBlock({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No Firestore data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" hide={data.length > 8} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="value" fill="#0f766e" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieBlock({ data, empty }: { data: Array<{ name: string; value: number }>; empty: string }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={80}>
          {data.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
