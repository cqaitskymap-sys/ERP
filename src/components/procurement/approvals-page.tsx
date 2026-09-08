"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { getPendingApprovals } from "@/lib/procurement/client";
import { workflowTone } from "@/lib/procurement/catalog";
import { publicMasterError } from "@/lib/masters/errors";

export function PendingApprovalsPage() {
  return (
    <RequirePermission permission="procurement:read">
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
      void getPendingApprovals()
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
      <PageHeader title="Pending approvals" description="Steps come from configured approval workflows. Separation of duties is enforced unless the workflow allows self-approval." />
      {!rows.length ? (
        <EmptyState title="No pending approvals" description="Submitted PRs, selections, POs, and amendments will appear here." />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Link key={row.id} href={hrefFor(row)} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-4">
              <div>
                <p className="font-medium">{String(row.documentNumber || row.documentId)}</p>
                <p className="text-xs text-muted-foreground">
                  {String(row.documentType)} · step {String(row.step)} · {String(row.label || row.role)}
                </p>
              </div>
              <StatusBadge label={String(row.status)} tone={workflowTone(row.status)} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function hrefFor(row: Record<string, unknown>) {
  const type = String(row.documentType || "");
  const id = String(row.documentId || "");
  if (type === "purchaseRequisition") return `/procurement/requisitions/${id}`;
  if (type === "purchaseOrder") return `/procurement/orders/${id}`;
  if (type === "vendorSelection") return `/procurement/rfqs/${String(row.rfqId || id)}`;
  if (type === "purchaseOrderAmendment") return `/procurement/amendments/${id}`;
  return "/procurement/approvals";
}
