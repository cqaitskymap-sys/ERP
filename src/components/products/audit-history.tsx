"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

export function AuditHistory({ resource, resourceId }: { resource: string; resourceId: string }) {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const token = await getFirebaseAuth().currentUser?.getIdToken();
          const response = await fetch(
            `/api/audit?resource=${encodeURIComponent(resource)}&resourceId=${encodeURIComponent(resourceId)}`,
            { headers: { "x-firebase-id-token": token || "" } }
          );
          const body = (await response.json()) as { rows?: Array<Record<string, unknown>>; error?: string };
          if (!response.ok) throw new Error(body.error);
          setRows(body.rows || []);
        } catch (err) {
          setError(publicMasterError(err));
        } finally {
          setLoading(false);
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resource, resourceId]);

  if (loading) return <LoadingState />;
  if (error) return <EmptyState title="Audit history unavailable" description={error} />;
  if (!rows.length) {
    return (
      <EmptyState
        title="No audit events yet"
        description="Critical create, update, approval, and deactivation events will appear here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={String(row.id)} className="rounded-lg border p-3">
          <p className="text-sm font-medium">
            {String(row.action)} · {String(row.description || row.resource)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {String(row.actorEmail || row.actorId)} · {String(row.createdAt || "")}
          </p>
        </div>
      ))}
    </div>
  );
}
