"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getExpiryMonitor,
  getQuarantineDashboard,
  getStockCard,
  getTraceability,
  getWarehouseReport,
} from "@/lib/inventory/client";
import { inventoryReportOptions } from "@/lib/inventory/catalog";
import { INVENTORY_EXPIRY_WINDOWS_DAYS, inventoryExpiryLabel } from "@/lib/inventory/expiry";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { InventoryExpiryState } from "@/types/inventory";

export function QuarantineBoard() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getQuarantineDashboard()
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (!stats && !error) return <LoadingState />;
  if (error || !stats) return <EmptyState title="Unable to load quarantine" description={error || ""} />;
  const rows = (stats.rows as Array<Record<string, unknown> & { id: string }>) || [];
  return (
    <RequirePermission permission="inventory:read">
      <div>
        <PageHeader title="Quarantine" description="Incoming stock stays here until QA releases it. Warehouse users cannot release material." />
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Items" value={Number(stats.totalItems || 0)} />
          <Metric label="Quantity" value={Number(stats.quarantineQuantity || 0)} />
          <Metric label="Pending QC" value={Number(stats.pendingQc || 0)} />
          <Metric label="Overdue testing" value={Number(stats.overdueTesting || 0)} />
          <Metric label="Recently received" value={Number(stats.recentlyReceived || 0)} />
          <Metric label="Aging" value={Number(stats.aging || 0)} />
        </div>
        <div className="space-y-2">
          {rows.map((row) => (
            <Link key={row.id} href={`/warehouse/inventory/${row.id}`} className="block rounded-xl border p-4 hover:bg-muted/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{String(row.itemCode)} · {String(row.batchNumber)}</p>
                  <p className="text-sm text-muted-foreground">
                    {String(row.itemName)} · {String(row.availableQuantity)} {String(row.uom || "")} · {String(row.daysInQuarantine)} days
                  </p>
                </div>
                <StatusBadge label={`QC ${String(row.qcStatus || "pending")}`} tone="warning" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </RequirePermission>
  );
}

export function ExpiryBoard() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getExpiryMonitor()
        .then((result) => setStats(result.stats))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (!stats && !error) return <LoadingState />;
  if (error || !stats) return <EmptyState title="Unable to load expiry" description={error || ""} />;
  const counts = (stats.counts || {}) as Record<string, number>;
  const quantities = (stats.quantities || {}) as Record<string, number>;
  const rows = (stats.rows || {}) as Record<string, Array<Record<string, unknown> & { id: string }>>;
  return (
    <RequirePermission permission="inventory:read">
      <div>
        <PageHeader
          title="Expiry management"
          description={`Windows: ${INVENTORY_EXPIRY_WINDOWS_DAYS.join(", ")} days. Values come from live batch expiry dates.`}
        />
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {["expired", "expiring_7", "expiring_30", "expiring_60", "expiring_90"].map((key) => (
            <Metric
              key={key}
              label={inventoryExpiryLabel(key as InventoryExpiryState)}
              value={quantities[key] || 0}
              hint={`${counts[key] || 0} batches`}
            />
          ))}
        </div>
        {Object.entries(rows).map(([key, list]) => (
          <section key={key} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold">{inventoryExpiryLabel(key as InventoryExpiryState)}</h2>
            <div className="space-y-2">
              {list.map((row) => (
                <Link key={row.id} href={`/warehouse/inventory/${row.id}`} className="block rounded-lg border p-3 text-sm">
                  {String(row.itemCode)} · {String(row.batchNumber)} · {String(row.expiryDate)} · {String(row.availableQuantity)}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </RequirePermission>
  );
}

export function TraceabilityPage() {
  const [batchNumber, setBatchNumber] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("batchNumber") || ""
  );
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function search(value = batchNumber) {
    if (!value.trim()) return;
    try {
      const response = await getTraceability(value);
      setResult(response.result);
    } catch (error) {
      toast.error("Traceability lookup failed", publicMasterError(error));
    }
  }

  useEffect(() => {
    const initial =
      typeof window === "undefined"
        ? ""
        : new URLSearchParams(window.location.search).get("batchNumber") || "";
    if (!initial) return;
    const timer = window.setTimeout(() => {
      void getTraceability(initial)
        .then((response) => setResult(response.result))
        .catch((error) => toast.error("Traceability lookup failed", publicMasterError(error)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <RequirePermission permission="batchTraceability:read">
      <div>
        <PageHeader title="Batch traceability" description="Supplier → receipt → quality → storage → transfer → issue." />
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <Input className="min-h-11" placeholder="Batch number" value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} />
          <Button className="min-h-11" onClick={() => void search()}>Trace</Button>
        </div>
        {result ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Current quantity: {String(result.currentQuantity || 0)}</p>
            {((result.events as Array<Record<string, unknown>>) || []).map((event, index) => (
              <div key={index} className="rounded-xl border p-4">
                <p className="font-medium">{String(event.title)}</p>
                <p className="text-sm text-muted-foreground">{String(event.performedAt)} · {String(event.detail || "")}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Enter a batch number" description="Authorized users can follow the inventory side of the pharma chain." />
        )}
      </div>
    </RequirePermission>
  );
}

export function StockCardPage() {
  const [params, setParams] = useState(() => {
    if (typeof window === "undefined") {
      return { itemId: "", batchNumber: "", warehouseId: "", from: "", to: "" };
    }
    const search = new URLSearchParams(window.location.search);
    return {
      itemId: search.get("itemId") || search.get("materialId") || "",
      batchNumber: search.get("batchNumber") || "",
      warehouseId: search.get("warehouseId") || "",
      from: search.get("from") || "",
      to: search.get("to") || "",
    };
  });
  const [card, setCard] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const query = {
      itemId: search.get("itemId") || search.get("materialId") || "",
      batchNumber: search.get("batchNumber") || "",
      warehouseId: search.get("warehouseId") || "",
      from: search.get("from") || "",
      to: search.get("to") || "",
    };
    if (!query.itemId) return;
    const timer = window.setTimeout(() => {
      void getStockCard(query)
        .then((result) => setCard(result.card))
        .catch((error) => toast.error("Unable to load stock card", publicMasterError(error)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function load(query = params) {
    try {
      const result = await getStockCard(query);
      setCard(result.card);
    } catch (error) {
      toast.error("Unable to load stock card", publicMasterError(error));
    }
  }

  return (
    <RequirePermission permission="inventory:read">
      <div>
        <PageHeader
          title="Stock card"
          description="Opening, receipts, transfers, issues, returns, adjustments, and closing balance."
          actions={
            card ? (
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  downloadCsv(
                    "stock-card.csv",
                    recordsToCsv((card.rows as Array<Record<string, unknown>>) || [], [
                      "transactionNumber",
                      "transactionType",
                      "quantityIn",
                      "quantityOut",
                      "balanceAfter",
                      "performedAt",
                    ])
                  )
                }
              >
                Export
              </Button>
            ) : null
          }
        />
        <div className="mb-6 grid gap-3 md:grid-cols-5">
          <Field label="Item ID"><Input className="min-h-11" value={params.itemId} onChange={(event) => setParams({ ...params, itemId: event.target.value })} /></Field>
          <Field label="Batch"><Input className="min-h-11" value={params.batchNumber} onChange={(event) => setParams({ ...params, batchNumber: event.target.value })} /></Field>
          <Field label="From"><Input className="min-h-11" type="date" value={params.from} onChange={(event) => setParams({ ...params, from: event.target.value })} /></Field>
          <Field label="To"><Input className="min-h-11" type="date" value={params.to} onChange={(event) => setParams({ ...params, to: event.target.value })} /></Field>
          <Button className="min-h-11 self-end" onClick={() => void load()}>Load</Button>
        </div>
        {card ? (
          <>
            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Opening" value={Number(card.opening || 0)} />
              <Metric label="Receipts" value={Number(card.receipts || 0)} />
              <Metric label="Issues" value={Number(card.issues || 0)} />
              <Metric label="Closing" value={Number(card.closing || 0)} />
            </div>
            <div className="space-y-2">
              {((card.rows as Array<Record<string, unknown>>) || []).map((row, index) => (
                <div key={index} className="rounded-lg border p-3 text-sm">
                  {String(row.performedAt)} · {String(row.transactionType)} · in {String(row.quantityIn)} / out {String(row.quantityOut)} · bal {String(row.balanceAfter)}
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState title="Select an item" description="Stock card totals are calculated from the immutable ledger." />
        )}
      </div>
    </RequirePermission>
  );
}

export function ReportsPage() {
  const [type, setType] = useState("current_stock");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);

  async function run() {
    try {
      const result = await getWarehouseReport(type);
      setRows(result.rows);
    } catch (error) {
      toast.error("Unable to load report", publicMasterError(error));
    }
  }

  return (
    <RequirePermission permission="inventory:read">
      <div>
        <PageHeader
          title="Warehouse reports"
          description="Filterable operational reports with CSV export."
          actions={
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => downloadCsv(`${type}.csv`, recordsToCsv(rows, Object.keys(rows[0] || { id: "" })))}
            >
              Export CSV
            </Button>
          }
        />
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="min-h-11 sm:w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              {inventoryReportOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="min-h-11" onClick={() => void run()}>Run report</Button>
        </div>
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={String(row.id || index)} className="rounded-lg border p-3 text-sm">
              {String(row.itemCode || row.receiptNumber || row.transferNumber || row.issueNumber || row.adjustmentNumber || row.transactionNumber || row.batchNumber || row.id)}
              {" · "}
              {String(row.availableQuantity ?? row.quantity ?? row.status ?? "")}
            </div>
          ))}
        </div>
      </div>
    </RequirePermission>
  );
}

function Metric({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
