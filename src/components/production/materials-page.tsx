"use client";

import { useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMaterialPlan, listProduction } from "@/lib/production/client";
import { workflowTone } from "@/lib/production/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

type Line = Record<string, unknown>;

export function MaterialsPage() {
  return (
    <RequirePermission permission="manufacturingOrder:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [orderId, setOrderId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      if (!orderId) {
        const listed = await listProduction("orders", { pageSize: 1 });
        const first = listed.rows[0];
        if (!first) {
          toast.error("No manufacturing orders found");
          return;
        }
        setOrderId(first.id);
        const result = await getMaterialPlan(first.id);
        setLines((result.result.availability as Line[]) || []);
        return;
      }
      const result = await getMaterialPlan(orderId);
      setLines((result.result.availability as Line[]) || []);
    } catch (error) {
      toast.error("Unable to load material plan", publicMasterError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Material requirements"
        description="Required quantities come from the effective BOM and batch size. Only approved inventory counts as available."
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <Input className="min-h-11" placeholder="Manufacturing order ID" value={orderId} onChange={(event) => setOrderId(event.target.value)} />
        <Button className="min-h-11" onClick={() => void load()}>{loading ? "Loading…" : "Calculate"}</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {lines.map((line) => (
          <div key={String(line.materialId)} className="rounded-xl border p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-medium">{String(line.materialId)}</p>
              <StatusBadge label={String(line.status)} tone={workflowTone(line.status)} />
            </div>
            <p className="text-sm">Required: {String(line.requiredQuantity)} {String(line.uom)}</p>
            <p className="text-sm">Available: {String(line.availableQuantity)}</p>
            <p className="text-sm">Approved: {String(line.approvedQuantity)} · Quarantine: {String(line.quarantineQuantity)}</p>
            <p className="text-sm">Blocked: {String(line.blockedQuantity)} · Rejected: {String(line.rejectedQuantity)}</p>
            <p className="text-sm font-medium">Shortage: {String(line.shortage)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{String(line.suggestedAction || "")}</p>
            {String(line.status) === "short" ? (
              <Button asChild variant="outline" className="mt-3 min-h-11">
                <Link href="/procurement/requisitions/new">Procurement Required</Link>
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
