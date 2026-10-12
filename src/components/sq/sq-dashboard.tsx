"use client";

import { BarBlock, ChartCard, PieBlock, toChart } from "@/components/charts/dashboard-charts";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { getSqDashboard } from "@/lib/supplier-quality/client";
import { publicMasterError } from "@/lib/masters/errors";

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
    <Link href={href} className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_16px_32px_-24px_color-mix(in_oklch,var(--primary)_70%,transparent)]">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{Number(value || 0)}</p>
    </Link>
  );
}
