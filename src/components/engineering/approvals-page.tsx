"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { getPendingEngineeringApprovals } from "@/lib/engineering/client";
import {
  calibrationStatusOptions,
  labelFor,
  qualificationStatusOptions,
  workOrderStatusOptions,
  workflowTone,
} from "@/lib/engineering/catalog";
import { publicMasterError } from "@/lib/masters/errors";

const ROUTES: Record<string, (id: string) => string> = {
  workOrders: (id) => `/engineering/work-orders/${id}`,
  calibrations: (id) => `/engineering/calibration/${id}`,
  qualifications: (id) => `/engineering/qualifications/${id}`,
};

const STATUS_OPTIONS: Record<string, Array<{ label: string; value: string }>> = {
  workOrders: workOrderStatusOptions,
  calibrations: calibrationStatusOptions,
  qualifications: qualificationStatusOptions,
};

export function EngineeringApprovalsPage() {
  return (
    <RequirePermission permission="engineeringWorkOrder:approve">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getPendingEngineeringApprovals()
        .then((result) => setRows(result.rows))
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <EmptyState title="Unable to load approvals" description={error} />;

  return (
    <div>
      <PageHeader
        title="Engineering approvals"
        description="Work orders, calibrations, and qualifications awaiting workflow steps."
      />
      {!rows.length ? (
        <EmptyState title="No pending approvals" description="Approval queues are empty." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const resource = String(row.resource || "workOrders");
            const href = ROUTES[resource]?.(row.id) || `/engineering/approvals#${row.id}`;
            const number =
              row.workOrderNumber || row.calibrationNumber || row.qualificationNumber || row.id;
            const statusOpts = STATUS_OPTIONS[resource] || workOrderStatusOptions;
            return (
              <Link key={`${resource}-${row.id}`} href={href} className="block rounded-xl border p-4 hover:bg-muted/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{String(number)}</p>
                  <StatusBadge
                    label={labelFor(statusOpts, String(row.status || ""))}
                    tone={workflowTone(String(row.status || ""))}
                  />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {resource} · equipment {String(row.equipmentId || row.instrumentId || "—")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
