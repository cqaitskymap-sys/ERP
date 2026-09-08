"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getOverduePurchaseOrders, getPurchaseTracking, listProcurement } from "@/lib/procurement/client";
import { workflowTone } from "@/lib/procurement/catalog";
import { publicMasterError } from "@/lib/masters/errors";

export function PurchaseTrackingPage({ id }: { id?: string }) {
  return (
    <RequirePermission permission="purchaseTracking:read">
      <TrackingInner initialId={id || ""} />
    </RequirePermission>
  );
}

function TrackingInner({ initialId }: { initialId: string }) {
  const [orderId, setOrderId] = useState(initialId);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [orders, setOrders] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  const [overdue, setOverdue] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  function load(id: string) {
    void getPurchaseTracking(id)
      .then((response) => setResult(response.result))
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listProcurement("orders", { pageSize: 20 }).then((res) => setOrders(res.rows)).catch(() => setOrders([]));
      void getOverduePurchaseOrders().then((res) => setOverdue(res.rows)).catch(() => setOverdue([]));
      if (initialId) load(initialId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialId]);

  const stages = (result?.stages as Array<Record<string, unknown>>) || [];

  return (
    <div>
      <PageHeader title="Purchase tracking" description="Timeline is built from real PR, RFQ, quotation, PO, and goods-receipt records. Future QC/QA stages stay pending until those modules exist." />
      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <Input className="min-h-11 md:max-w-sm" placeholder="Purchase order ID" value={orderId} onChange={(event) => setOrderId(event.target.value)} />
        <Button className="min-h-11" onClick={() => load(orderId)}>Load timeline</Button>
      </div>
      {!result && !initialId ? (
        <div className="mb-6 grid gap-2">
          {orders.map((row) => (
            <button key={row.id} className="rounded-lg border p-3 text-left text-sm" onClick={() => { setOrderId(row.id); load(row.id); }}>
              {String(row.poNumber || row.id)} · {String(row.status)}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <EmptyState title="Unable to load tracking" description={error} /> : null}
      {result && !stages.length ? <LoadingState /> : null}
      {stages.length ? (
        <ol className="mb-8 space-y-3">
          {stages.map((stage) => (
            <li key={String(stage.id)} className="flex items-start gap-3 rounded-xl border p-4">
              <StatusBadge
                label={String(stage.status) === "done" ? "Done" : String(stage.status) === "unavailable" ? "Not yet available" : "Pending"}
                tone={workflowTone(stage.status === "done" ? "approved" : stage.status === "unavailable" ? "draft" : "submitted")}
              />
              <div>
                <p className="font-medium">{String(stage.label)}</p>
                <p className="text-xs text-muted-foreground">{String(stage.at || stage.note || "Pending / Not Yet Available")}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {overdue.length ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold">Overdue purchase orders</h2>
          <div className="space-y-2">
            {overdue.map((row) => (
              <div key={String(row.id)} className="rounded-lg border p-3 text-sm">
                {String(row.poNumber)} · vendor {String(row.vendorId)} · remaining {String(row.remainingQuantity)} · {String(row.daysOverdue)} days overdue
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
