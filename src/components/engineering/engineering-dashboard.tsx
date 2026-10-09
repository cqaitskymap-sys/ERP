"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getEngineeringDashboard } from "@/lib/engineering/client";
import { publicMasterError } from "@/lib/masters/errors";

type Stats = Record<string, unknown>;

export function EngineeringDashboard() {
  return (
    <RequirePermission permission="engineering:read">
      <DashboardInner />
    </RequirePermission>
  );
}

function DashboardInner() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "", facilityId: "", status: "" });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getEngineeringDashboard(filters)
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [filters]);

  if (!stats && !error) return <LoadingState variant="page" />;
  if (error || !stats) {
    return (
      <EmptyState title="Unable to load engineering metrics" description={error || "Try again after signing in."} />
    );
  }

  const kpis = (stats.kpis || stats) as Record<string, number | null>;
  const metricEntries = Object.entries(kpis).filter(([, value]) => value != null);

  return (
    <div>
      <PageHeader
        title="Engineering & maintenance"
        description="Equipment, PM, calibration, breakdowns, and utility monitoring from live engineering records."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/engineering/work-orders/new">New work order</Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/engineering/breakdowns/new">Report breakdown</Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Input
          className="min-h-11"
          type="date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
        />
        <Input
          className="min-h-11"
          type="date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
        />
        <Input
          className="min-h-11"
          placeholder="Facility ID"
          value={filters.facilityId}
          onChange={(e) => setFilters({ ...filters, facilityId: e.target.value })}
        />
        <Input
          className="min-h-11"
          placeholder="Equipment status filter"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        />
      </div>
      {metricEntries.length ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricEntries.map(([key, value]) => (
            <Metric key={key} label={humanizeKey(key)} value={value} href={kpiHref(key)} />
          ))}
        </div>
      ) : (
        <p className="mb-6 text-sm text-muted-foreground">No KPI aggregates returned yet.</p>
      )}
      {stats.notes ? (
        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          {Object.entries(stats.notes as Record<string, string>).map(([key, note]) => (
            <p key={key}>
              <span className="font-medium text-foreground">{humanizeKey(key)}:</span> {note}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value, href }: { label: string; value?: number | null; href: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{Number(value || 0).toLocaleString()}</p>
    </Link>
  );
}

function humanizeKey(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function kpiHref(key: string) {
  const lower = key.toLowerCase();
  if (lower.includes("calibration")) return "/engineering/calibration";
  if (lower.includes("breakdown")) return "/engineering/breakdowns";
  if (lower.includes("workorder") || lower.includes("work order")) return "/engineering/work-orders";
  if (lower.includes("maintenance") || lower.includes("preventive")) return "/engineering/preventive";
  if (lower.includes("utility") || lower.includes("monitoring")) return "/engineering/utility-monitoring";
  if (lower.includes("qualification")) return "/engineering/qualifications";
  if (lower.includes("spare")) return "/engineering/spare-parts";
  if (lower.includes("approval")) return "/engineering/approvals";
  if (lower.includes("cost")) return "/engineering/costs";
  if (lower.includes("downtime")) return "/engineering/downtime";
  return "/engineering/equipment";
}
