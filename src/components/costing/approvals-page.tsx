"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { getPendingCostingApprovals } from "@/lib/costing/client";
import { costingStatusOptions, labelFor, workflowTone } from "@/lib/costing/catalog";
import { publicMasterError } from "@/lib/masters/errors";

const ROUTES: Record<string, (id: string) => string> = {
  standards: (id) => `/costing/standards/${id}`,
  batches: (id) => `/costing/batches/${id}`,
};

export function CostingApprovalsPage() {
  return (
    <RequirePermission permission="costing:approve">
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
      void getPendingCostingApprovals()
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
      <PageHeader title="Costing approvals" description="Product standards and batch costing awaiting workflow steps." />
      {!rows.length ? (
        <EmptyState title="No pending approvals" description="Approval queues are empty." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const resource = String(row.resource || "batches");
            const href = ROUTES[resource]?.(row.id) || `/costing/approvals#${row.id}`;
            const number = row.standardNumber || row.batchCostingNumber || row.id;
            return (
              <Link key={`${resource}-${row.id}`} href={href} className="block rounded-xl border p-4 hover:bg-muted/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{String(number)}</p>
                  <StatusBadge
                    label={labelFor(costingStatusOptions, String(row.status || ""))}
                    tone={workflowTone(String(row.status || ""))}
                  />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {resource} · product {String(row.productId || "—")} · {String(row.manufacturingOrderId || row.bomId || "")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
