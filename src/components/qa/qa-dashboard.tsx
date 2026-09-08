"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getQaDashboard } from "@/lib/qa/client";
import { labelFor, qaPriorityOptions, qaReviewStatusOptions, workflowTone } from "@/lib/qa/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { useAuth } from "@/hooks/use-auth";

const COLORS = ["#0f766e", "#0369a1", "#b45309", "#be123c", "#6d28d9", "#334155"];

type QueueRow = {
  id: string;
  reviewNumber: string;
  batchNumber: string;
  productId: string;
  customerId: string;
  status: string;
  dueDate: string;
  qcCompletedAt: string;
  priority: string;
};

export function QaDashboard() {
  return (
    <RequirePermission permission="qa:read">
      <DashboardInner />
    </RequirePermission>
  );
}

function DashboardInner() {
  const { can } = useAuth();
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getQaDashboard()
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!stats && !error) return <LoadingState />;
  if (error || !stats) {
    return <EmptyState title="Unable to load QA metrics" description={error || "Try again after signing in."} />;
  }

  const kpis = (stats.kpis || {}) as Record<string, number>;
  const charts = (stats.charts || {}) as Record<string, Record<string, number>>;
  const queue = ((stats.queue || []) as QueueRow[]);

  return (
    <div>
      <PageHeader
        title="Quality Assurance dashboard"
        description="Live batch review, release, hold, deviation, and CAPA metrics from Firestore. QC cannot release finished product from here."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/qa/reviews">Batch review</Link>
            </Button>
            {can("qaDeviation:create") ? (
              <Button asChild className="min-h-11">
                <Link href="/qa/deviations/new">New deviation</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Batches pending QA" value={kpis.pendingQa} href="/qa/reviews" />
        <Metric label="Under review" value={kpis.underReview} href="/qa/reviews" />
        <Metric label="Released" value={kpis.released} href="/qa/release" />
        <Metric label="On hold" value={kpis.held} href="/qa/hold" />
        <Metric label="Rejected" value={kpis.rejected} href="/qa/rejection" />
        <Metric label="Open deviations" value={kpis.openDeviations} href="/qa/deviations" />
        <Metric label="Open CAPA" value={kpis.openCapa} href="/qa/capa" />
        <Metric label="Pending change controls" value={kpis.pendingChanges} href="/qa/change-control" />
        <Metric label="OOS pending review" value={kpis.oosPending} href="/qc/oos" />
        <Metric label="OOT pending review" value={kpis.ootPending} href="/qc/oot" />
        <Metric label="Expiring documents" value={kpis.expiringDocuments} href="/qa/documents" />
        <Metric label="Average QA TAT (hours)" value={kpis.averageTatHours} href="/qa/reports" />
      </div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">QA work queue</CardTitle>
        </CardHeader>
        <CardContent>
          {queue.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Batch</th>
                    <th className="p-2">Product</th>
                    <th className="p-2">Customer</th>
                    <th className="p-2">QC completed</th>
                    <th className="p-2">Due</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Priority</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="p-2 font-medium">{row.batchNumber || row.reviewNumber}</td>
                      <td className="p-2">{row.productId || "—"}</td>
                      <td className="p-2">{row.customerId || "—"}</td>
                      <td className="p-2">{row.qcCompletedAt ? row.qcCompletedAt.slice(0, 10) : "—"}</td>
                      <td className="p-2">{row.dueDate || "—"}</td>
                      <td className="p-2">
                        <StatusBadge label={labelFor(qaReviewStatusOptions, row.status)} tone={workflowTone(row.status)} />
                      </td>
                      <td className="p-2">
                        <StatusBadge label={labelFor(qaPriorityOptions, row.priority)} tone={workflowTone(row.priority)} />
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-2">
                          <Link className="underline" href={`/qa/reviews/${row.id}`}>View</Link>
                          <Link className="underline" href={`/qa/reviews/${row.id}`}>Review</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No batches are waiting in the QA queue.</p>
          )}
        </CardContent>
      </Card>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Batch disposition">
          <PieBlock data={toChart(charts.byDecision)} empty="No QA reviews posted yet." />
        </ChartCard>
        <ChartCard title="QA turnaround (hours)">
          <BarBlock
            data={[
              { name: "Average", value: Number(kpis.averageTatHours || 0) },
              { name: "Minimum", value: Number(kpis.minTatHours || 0) },
              { name: "Maximum", value: Number(kpis.maxTatHours || 0) },
            ]}
          />
        </ChartCard>
        <ChartCard title="Release trend">
          <BarBlock data={toChart(charts.releaseTrend)} />
        </ChartCard>
        <ChartCard title="Rejection trend">
          <BarBlock data={toChart(charts.rejectTrend)} />
        </ChartCard>
        <ChartCard title="Deviation trend">
          <BarBlock data={toChart(charts.deviationTrend)} />
        </ChartCard>
        <ChartCard title="CAPA status">
          <PieBlock data={toChart(charts.capaStatus)} empty="No CAPA records yet." />
        </ChartCard>
        <ChartCard title="Change control status">
          <PieBlock data={toChart(charts.changeStatus)} empty="No change controls yet." />
        </ChartCard>
        <ChartCard title="Customer-wise release volume">
          <BarBlock data={toChart(charts.byCustomer)} />
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
  if (!data.length || data.every((item) => !item.value)) return <p className="text-sm text-muted-foreground">No posted QA data yet.</p>;
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
