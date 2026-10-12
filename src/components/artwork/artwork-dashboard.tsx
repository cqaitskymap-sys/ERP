"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { getArtworkDashboard, type ArtworkRow } from "@/lib/artwork/client";
import { artworkStatusLabel, artworkStatusTone } from "@/lib/artwork/status";
import { publicMasterError } from "@/lib/masters/errors";
import { BarBlock, ChartCard, PieBlock } from "@/components/charts/dashboard-charts";

export function ArtworkDashboard() {
  return (
    <RequirePermission permission="artwork:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [kpis, setKpis] = useState<Record<string, number> | null>(null);
  const [queue, setQueue] = useState<ArtworkRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getArtworkDashboard()
        .then((result) => {
          setKpis(result.kpis);
          setQueue(result.queue);
        })
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!kpis && !error) return <LoadingState variant="page" />;
  if (error || !kpis) return <EmptyState title="Unable to load artwork" description={error || "Try again after signing in."} />;

  return (
    <div>
      <PageHeader
        title="Artwork approval"
        description="Carton, foil, label, and leaflet jobs for the Bhiwadi site. Packaging, QA, regulatory, then the customer."
        actions={
          <Button asChild className="min-h-11">
            <Link href="/artwork/requests/new">New artwork</Link>
          </Button>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Open jobs" value={kpis.open} href="/artwork/requests" />
        <Metric label="In review" value={kpis.inReview} href="/artwork/requests" />
        <Metric label="With the customer" value={kpis.withCustomer} href="/artwork/approvals" />
        <Metric label="Changes requested" value={kpis.changes} href="/artwork/requests" />
        <Metric label="Due this week" value={kpis.dueSoon} href="/artwork/requests" />
        <Metric label="Effective" value={kpis.effective} href="/artwork/versions" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Where the jobs sit">
          <PieBlock
            data={[
              { name: "Packaging, QA, regulatory", value: Math.max(0, kpis.inReview - kpis.withCustomer) },
              { name: "With the customer", value: kpis.withCustomer },
              { name: "Changes requested", value: kpis.changes },
              { name: "Draft", value: Math.max(0, kpis.open - kpis.inReview - kpis.changes) },
              { name: "Effective", value: kpis.effective },
            ]}
            empty="No artwork jobs yet."
          />
        </ChartCard>
        <ChartCard title="Components in the queue">
          <BarBlock
            data={Object.entries(
              queue.reduce<Record<string, number>>((counts, row) => {
                const key = String(row.component || "Other");
                counts[key] = (counts[key] || 0) + 1;
                return counts;
              }, {})
            ).map(([name, value]) => ({ name, value }))}
            empty="No components in the queue."
          />
        </ChartCard>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h2 className="font-heading text-base font-semibold">Jobs on the lane</h2>
          <Button asChild variant="outline" className="min-h-9">
            <Link href="/artwork/requests">All jobs</Link>
          </Button>
        </div>
        <ul className="divide-y divide-border/70">
          {queue.map((row) => (
            <li key={row.id}>
              <Link href={`/artwork/requests/${row.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{String(row.artworkNumber || row.id)}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {String(row.title || "")} · {String(row.customerId || "")} · {String(row.component || "")}
                  </p>
                </div>
                <StatusBadge label={artworkStatusLabel(row.status)} tone={artworkStatusTone(row.status)} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Metric({ label, value, href }: { label: string; value?: number; href: string }) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_16px_32px_-24px_color-mix(in_oklch,var(--primary)_70%,transparent)]"
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-2xl font-semibold tracking-tight tabular-nums">{Number(value || 0).toLocaleString("en-IN")}</p>
    </Link>
  );
}
