"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { getPendingHrApprovals } from "@/lib/hr/client";
import {
  labelFor,
  leaveStatusOptions,
  overtimeStatusOptions,
  payrollStatusOptions,
  workflowTone,
} from "@/lib/hr/catalog";
import { publicMasterError } from "@/lib/masters/errors";

const ROUTES: Record<string, (id: string) => string> = {
  leave: (id) => `/hr/leave#${id}`,
  attendance_correction: (id) => `/hr/attendance#${id}`,
  overtime: (id) => `/hr/overtime#${id}`,
  payroll: (id) => `/hr/payroll/${id}`,
};

export function HrApprovalsPage({
  filterType,
  permission = "hrLeave:approve",
}: {
  filterType?: "payroll" | "all";
  permission?: import("@/types/permissions").Permission;
}) {
  return (
    <RequirePermission permission={permission}>
      <Inner filterType={filterType} />
    </RequirePermission>
  );
}

function Inner({ filterType = "all" }: { filterType?: "payroll" | "all" }) {
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getPendingHrApprovals()
        .then((result) => setRows(result.rows))
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <EmptyState title="Unable to load approvals" description={error} />;

  const filtered =
    filterType === "payroll"
      ? rows.filter((row) => String(row.approvalType || "") === "payroll")
      : rows;

  const title = filterType === "payroll" ? "Payroll approvals" : "HR approvals";
  const description =
    filterType === "payroll"
      ? "Payroll runs awaiting HR or finance workflow steps."
      : "Leave, attendance corrections, overtime, and payroll awaiting approval.";

  return (
    <div>
      <PageHeader title={title} description={description} />
      {!filtered.length ? (
        <EmptyState title="No pending approvals" description="Approval queues are empty." />
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const approvalType = String(row.approvalType || "leave");
            const href = ROUTES[approvalType]?.(row.id) || `/hr/approvals#${row.id}`;
            const number =
              row.applicationNumber ||
              row.overtimeNumber ||
              row.payrollNumber ||
              row.correctionNumber ||
              row.id;
            const statusOpts =
              approvalType === "overtime"
                ? overtimeStatusOptions
                : approvalType === "payroll"
                  ? payrollStatusOptions
                  : leaveStatusOptions;
            return (
              <Link key={`${approvalType}-${row.id}`} href={href} className="block rounded-xl border p-4 hover:bg-muted/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{String(number)}</p>
                  <StatusBadge
                    label={labelFor(statusOpts, String(row.status || ""))}
                    tone={workflowTone(String(row.status || ""))}
                  />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {approvalType.replace(/_/g, " ")} · employee {String(row.employeeId || row.employeeCode || "—")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
