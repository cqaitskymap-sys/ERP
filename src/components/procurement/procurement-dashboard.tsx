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
import { getProcurementDashboard } from "@/lib/procurement/client";
import { publicMasterError } from "@/lib/masters/errors";

const COLORS = ["#0f766e", "#0369a1", "#b45309", "#be123c", "#6d28d9", "#334155"];

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

  if (!stats && !error) return <LoadingState />;
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
    <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{Number(value || 0)}</p>
    </Link>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">{children}</CardContent>
    </Card>
  );
}

function toChart(map?: Record<string, number>) {
  return Object.entries(map || {}).map(([name, value]) => ({ name: name || "—", value: Number(value || 0) }));
}

function BarBlock({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No posted purchase data yet.</p>;
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

function PieBlock({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No PO status data yet.</p>;
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
