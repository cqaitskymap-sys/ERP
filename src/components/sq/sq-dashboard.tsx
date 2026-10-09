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
import { getSqDashboard } from "@/lib/supplier-quality/client";
import { publicMasterError } from "@/lib/masters/errors";

const COLORS = ["#0f766e", "#0369a1", "#b45309", "#be123c", "#6d28d9", "#334155"];

export function SqDashboard() {
  return (
    <RequirePermission permission="supplierQuality:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getSqDashboard().then((result) => setStats(result.stats)).catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!stats && !error) return <LoadingState variant="page" />;
  if (error || !stats) return <EmptyState title="Unable to load supplier-quality metrics" description={error || "Try again after signing in."} />;

  const kpis = (stats.kpis || {}) as Record<string, number>;
  const charts = (stats.charts || {}) as Record<string, Record<string, number>>;

  return (
    <div>
      <PageHeader
        title="Supplier Quality"
        description="Live qualification, audit, certificate, and performance metrics from Firestore. The system does not autonomously approve or disqualify suppliers."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11"><Link href="/sq/profiles/new">New profile</Link></Button>
            <Button asChild className="min-h-11"><Link href="/sq/qualifications/new">New qualification</Link></Button>
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total suppliers" value={kpis.totalSuppliers} href="/sq/profiles" />
        <Metric label="Qualified suppliers" value={kpis.qualifiedSuppliers} href="/sq/approved" />
        <Metric label="Pending qualification" value={kpis.pendingQualification} href="/sq/qualifications" />
        <Metric label="Qualification expiring" value={kpis.qualificationExpiring} href="/sq/qualifications" />
        <Metric label="Requalification due" value={kpis.requalificationDue} href="/sq/requalifications" />
        <Metric label="High risk" value={kpis.highRiskSuppliers} href="/sq/profiles" />
        <Metric label="Critical suppliers" value={kpis.criticalSuppliers} href="/sq/profiles" />
        <Metric label="Suspended" value={kpis.suspendedSuppliers} href="/sq/suspended" />
        <Metric label="Disqualified" value={kpis.disqualifiedSuppliers} href="/sq/suspended" />
        <Metric label="Open supplier CAPA" value={kpis.openSupplierCapa} href="/qa/capa" />
        <Metric label="Open supplier deviations" value={kpis.openSupplierDeviations} href="/qa/deviations" />
        <Metric label="Open audits" value={kpis.openSupplierAudits} href="/sq/audits" />
        <Metric label="Expiring documents" value={kpis.expiringDocuments} href="/sq/certificates" />
        <Metric label="Expiring certificates" value={kpis.expiringCertificates} href="/sq/certificates" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Suppliers by risk"><PieBlock data={toChart(charts.byRisk)} empty="No risk assessments yet." /></ChartCard>
        <ChartCard title="Suppliers by status"><BarBlock data={toChart(charts.byStatus)} /></ChartCard>
        <ChartCard title="Score trend"><BarBlock data={toChart(charts.scoreTrend)} /></ChartCard>
        <ChartCard title="Qualification trend"><BarBlock data={toChart(charts.qualTrend)} /></ChartCard>
        <ChartCard title="Audit findings"><BarBlock data={toChart(charts.findingTrend)} /></ChartCard>
        <ChartCard title="CAPA trend"><BarBlock data={toChart(charts.capaTrend)} /></ChartCard>
        <ChartCard title="Supplier deviations"><BarBlock data={toChart(charts.deviationTrend)} /></ChartCard>
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
  return <Card><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="h-64">{children}</CardContent></Card>;
}

function toChart(map: Record<string, number> | undefined) {
  return Object.entries(map || {}).map(([name, value]) => ({ name, value }));
}

function BarBlock({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No Firestore data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" hide={data.length > 8} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#0f766e" /></BarChart>
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
