"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getHrDashboard } from "@/lib/hr/client";
import { publicMasterError } from "@/lib/masters/errors";
import { BarBlock, ChartCard, PieBlock, toChart } from "@/components/charts/dashboard-charts";

type Stats = Record<string, unknown>;

type PayrollSummaryRow = {
  id?: string;
  number?: string;
  status?: string;
  periodFrom?: string;
  periodTo?: string;
};

export function HrDashboard() {
  return (
    <RequirePermission permission="hr:read">
      <DashboardInner />
    </RequirePermission>
  );
}

function DashboardInner() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ from: "", to: "", departmentId: "" });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getHrDashboard(filters)
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [filters]);

  if (!stats && !error) return <LoadingState variant="page" />;
  if (error || !stats) {
    return <EmptyState title="Unable to load HR metrics" description={error || "Try again after signing in."} />;
  }

  const kpiKeys = [
    "totalActiveEmployees",
    "newJoiners",
    "employeesOnLeave",
    "attendancePresentToday",
    "attendanceAbsentToday",
    "lateArrivalsToday",
    "pendingLeaveApprovals",
    "pendingOnboardingTasks",
    "trainingCompleted",
    "trainingOverdue",
    "openPayrollRuns",
    "openSeparations",
  ] as const;

  const metricEntries = kpiKeys
    .map((key) => [key, stats[key] as number | null | undefined] as const)
    .filter(([, value]) => value != null);

  const payrollSummary = stats.payrollStatusSummary;
  const payrollRestricted = payrollSummary === "[restricted]";

  return (
    <div>
      <PageHeader
        title="Human resources"
        description="Workforce, attendance, leave, payroll, and compliance from live HR records."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/hr/employees/new">New employee</Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/hr/leave/new">Leave application</Link>
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
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
          placeholder="Department ID"
          value={filters.departmentId}
          onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
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
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="People in today">
          <PieBlock
            data={[
              { name: "Present", value: Number(stats.attendancePresentToday || 0) },
              { name: "Late", value: Number(stats.lateArrivalsToday || 0) },
              { name: "Absent", value: Number(stats.attendanceAbsentToday || 0) },
              { name: "On leave", value: Number(stats.employeesOnLeave || 0) },
            ]}
            empty="No attendance posted for today."
          />
        </ChartCard>
        <ChartCard title="Active people by department">
          <BarBlock data={toChart(stats.departmentDistribution as Record<string, number>)} empty="No active employees in this scope." />
        </ChartCard>
      </div>
      <div className="mb-6 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">As of:</span> {String(stats.asOf || "—")}
        </p>
        {stats.departmentDistribution ? (
          <p className="mt-2">
            <span className="font-medium text-foreground">Active by department:</span>{" "}
            {Object.keys(stats.departmentDistribution as Record<string, number>).length} departments tracked
          </p>
        ) : null}
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-3 text-sm font-medium">Open payroll runs</p>
        {payrollRestricted ? (
          <p className="text-sm text-muted-foreground">
            Payroll summary is restricted for your role. Contact HR or finance for payroll visibility.
          </p>
        ) : Array.isArray(payrollSummary) && payrollSummary.length ? (
          <ul className="space-y-2 text-sm">
            {(payrollSummary as PayrollSummaryRow[]).map((row) => (
              <li key={String(row.id)}>
                <Link href={row.id ? `/hr/payroll/${row.id}` : "/hr/payroll"} className="text-primary underline-offset-4 hover:underline">
                  {String(row.number || row.id)} · {String(row.status)} · {String(row.periodFrom)} – {String(row.periodTo)}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No open payroll runs in the selected scope.</p>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, href }: { label: string; value?: number | null; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_16px_32px_-24px_color-mix(in_oklch,var(--primary)_70%,transparent)]">
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
  if (lower.includes("leave")) return "/hr/leave";
  if (lower.includes("payroll")) return "/hr/payroll";
  if (lower.includes("onboarding")) return "/hr/onboarding";
  if (lower.includes("training")) return "/hr/training";
  if (lower.includes("separation")) return "/hr/separations";
  if (lower.includes("attendance") || lower.includes("late")) return "/hr/attendance";
  if (lower.includes("joiner") || lower.includes("employee")) return "/hr/employees";
  return "/hr";
}
