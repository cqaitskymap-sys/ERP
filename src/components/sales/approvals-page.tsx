"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { getPendingSalesApprovals } from "@/lib/sales/client";
import { publicMasterError } from "@/lib/masters/errors";

export function SalesApprovalsPage() {
  return (
    <RequirePermission permission="salesOrder:approve">
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
      void getPendingSalesApprovals()
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
      <PageHeader title="Order approvals" description="Pending commercial approval steps from real sales workflows." />
      {!rows.length ? (
        <EmptyState title="No pending approvals" description="Approval queues are empty." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={
                String(row.documentType) === "salesQuotation"
                  ? `/sales/quotations/${row.documentId}`
                  : String(row.documentType) === "contractManufacturingOrder"
                    ? `/sales/cmo/${row.documentId}`
                    : `/sales/orders/${row.documentId}`
              }
              className="block rounded-xl border p-4 hover:bg-muted/40"
            >
              <p className="font-medium">{String(row.documentNumber || row.documentId)}</p>
              <p className="text-sm text-muted-foreground">
                {String(row.label || row.role)} · step {String(row.step)} · {String(row.documentType)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
