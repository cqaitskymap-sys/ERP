"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { getPendingDmsApprovals } from "@/lib/dms/client";
import { documentStatusOptions, dcrStatusOptions, labelFor, workflowTone } from "@/lib/dms/catalog";
import { publicMasterError } from "@/lib/masters/errors";

export function DmsApprovalsPage({ title = "Approvals", description = "Documents and change requests currently in review." }: { title?: string; description?: string }) {
  return (
    <RequirePermission permission="dms:read">
      <Inner title={title} description={description} />
    </RequirePermission>
  );
}

function Inner({ title, description }: { title: string; description: string }) {
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getPendingDmsApprovals()
        .then((result) => {
          setRows(result.rows);
          setError(null);
        })
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) return <LoadingState variant="page" />;
  return (
    <div>
      <PageHeader title={title} description={description} />
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      {!rows.length && !error ? (
        <EmptyState title="Nothing is waiting" description="Submitted documents and change requests appear here." />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const queue = String(row.queue || "document");
            const href = queue === "change_request" ? `/dms/change-requests/${row.id}` : `/dms/documents/${row.id}`;
            const status = String(row.status || "");
            const options = queue === "change_request" ? dcrStatusOptions : documentStatusOptions;
            return (
              <Link key={`${queue}-${row.id}`} href={href} className="block rounded-xl border bg-card p-4 hover:bg-muted/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{String(row.documentNumber || row.requestNumber || row.title || row.id)}</p>
                    <p className="text-sm text-muted-foreground">{String(row.title || queue)}</p>
                  </div>
                  <StatusBadge label={labelFor(options, status)} tone={workflowTone(status)} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
