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
import { Input } from "@/components/ui/input";
import { getSalesDashboard } from "@/lib/sales/client";
import { publicMasterError } from "@/lib/masters/errors";

const COLORS = ["#0f766e", "#0369a1", "#b45309", "#be123c", "#334155", "#0e7490"];

export function SalesDashboard() {
  return (
    <RequirePermission permission="sales:read">
      <DashboardInner />
    </RequirePermission>
  );
}

function DashboardInner() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "", customerId: "", status: "" });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getSalesDashboard(filters)
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [filters.from, filters.to, filters.customerId, filters.status]);

  if (!stats && !error) return <LoadingState variant="page" />;
  if (error || !stats) {
    return <EmptyState title="Unable to load sales metrics" description={error || "Try again after signing in."} />;
  }

  const kpis = (stats.kpis || {}) as Record<string, number>;
  const charts = (stats.charts || {}) as Record<string, Record<string, number>>;

  return (
    <div>
      <PageHeader
        title="Sales dashboard"
        description="Live sales order, quotation, fulfilment, and credit metrics from Firestore."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/sales/quotations/new">New quotation</Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/sales/orders/new">New sales order</Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Input className="min-h-11" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <Input className="min-h-11" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        <Input className="min-h-11" placeholder="Customer ID" value={filters.customerId} onChange={(e) => setFilters({ ...filters, customerId: e.target.value })} />
        <Input className="min-h-11" placeholder="Order status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} />
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total sales orders" value={kpis.totalOrders} href="/sales/orders" />
        <Metric label="Draft orders" value={kpis.draftOrders} href="/sales/orders" />
        <Metric label="Pending approval" value={kpis.pendingApproval} href="/sales/approvals" />
        <Metric label="Confirmed" value={kpis.confirmed} href="/sales/orders" />
        <Metric label="In production" value={kpis.inProduction} href="/sales/orders" />
        <Metric label="Awaiting QA release" value={kpis.awaitingQaRelease} href="/sales/fulfilment" />
        <Metric label="Ready for dispatch" value={kpis.readyForDispatch} href="/sales/fulfilment" />
        <Metric label="Partially fulfilled" value={kpis.partiallyFulfilled} href="/sales/fulfilment" />
        <Metric label="Delivered" value={kpis.delivered} href="/sales/orders" />
        <Metric label="Cancelled" value={kpis.cancelled} href="/sales/reports" />
        <Metric label="Outstanding balances" value={kpis.outstandingBalances} href="/sales/credit" />
        <Metric label="Monthly sales value" value={kpis.monthlySalesValue} href="/sales/reports" />
        <Metric label="Fulfilment %" value={kpis.fulfilmentPercent} href="/sales/fulfilment" />
        <Metric label="Delayed orders" value={kpis.delayedOrders} href="/sales/reports" />
        <Metric label="Pending approvals" value={kpis.pendingCommercialApprovals} href="/sales/approvals" />
        <Metric label="Blocked orders" value={kpis.blockedOrders} href="/sales/fulfilment" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Order status distribution">
          <PieBlock data={toChart(charts.byStatus)} />
        </ChartCard>
        <ChartCard title="Monthly sales trend">
          <BarBlock data={toChart(charts.monthly)} />
        </ChartCard>
        <ChartCard title="Top customers by order value">
          <BarBlock data={toChart(charts.topCustomers)} />
        </ChartCard>
        <ChartCard title="Best-selling products">
          <BarBlock data={toChart(charts.bestProducts)} />
        </ChartCard>
      </div>
    </div>
  );
}

function Metric({ label, value, href }: { label: string; value?: number; href: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{Number(value || 0).toLocaleString()}</p>
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
  if (!data.length) return <p className="text-sm text-muted-foreground">No posted sales data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" hide={data.length > 8} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill="#0f766e" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieBlock({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!data.length) return <p className="text-sm text-muted-foreground">No order status data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
