"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { getCostingReport } from "@/lib/costing/client";
import { publicMasterError } from "@/lib/masters/errors";

export function CostingAuditPage() {
  return (
    <RequirePermission permission="costing:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getCostingReport("incomplete_records", {})
        .then((result) => {
          setRows(result.rows);
          setError(null);
        })
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div>
      <PageHeader
        title="Costing audit & completeness"
        description="Incomplete batch costing records and data-quality gaps. Immutable workflow audit is retained in the enterprise audit module and costing action logs on each record."
      />
      <p className="mb-4 text-sm text-muted-foreground">
        This view lists batches flagged incomplete by costing validation. Open a batch to review missing components, lines,
        and workflow history.
      </p>
      {loading ? <LoadingState /> : null}
      {error ? <EmptyState title="Unable to load audit list" description={error} /> : null}
      {!loading && !error && !rows.length ? (
        <EmptyState title="No incomplete records" description="All in-scope batches passed completeness checks." />
      ) : null}
      {!loading && rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => {
            const id = String(row.id || "");
            return (
              <Link
                key={id}
                href={id ? `/costing/batches/${id}` : "/costing/batches"}
                className="block rounded-xl border p-4 hover:bg-muted/40"
              >
                <p className="font-medium">{String(row.batchCostingNumber || id)}</p>
                <p className="text-sm text-muted-foreground">
                  Status {String(row.status || "—")} · missing{" "}
                  {Array.isArray(row.missingComponents) ? row.missingComponents.join(", ") : String(row.missingComponents || "—")}
                </p>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
