"use client";

import { BarBlock, ChartCard, PieBlock, toChart } from "@/components/charts/dashboard-charts";
import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLowStock, getWarehouseDashboard } from "@/lib/inventory/client";
import { getLogisticsDashboard } from "@/lib/logistics/client";
import { inventoryItemTypeOptions, qualityStatusOptions } from "@/lib/inventory/catalog";
import { publicMasterError } from "@/lib/masters/errors";

export function WarehouseDashboard() {
  return (
    <RequirePermission permission="warehouse:read">
      <DashboardInner />
    </RequirePermission>
  );
}

function DashboardInner() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [logistics, setLogistics] = useState<Record<string, number>>({});
  const [lowStock, setLowStock] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([getWarehouseDashboard(), getLowStock(), getLogisticsDashboard().catch(() => ({ stats: { kpis: {} } }))])
        .then(([dash, stock, logisticsDash]) => {
          setStats(dash.stats);
          setLowStock(stock.rows);
          setLogistics(((logisticsDash.stats as { kpis?: Record<string, number> })?.kpis) || {});
        })
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!stats && !error) return <LoadingState variant="page" />;
  if (error || !stats) {
    return <EmptyState title="Unable to load warehouse metrics" description={error || "Try again after signing in."} />;
  }

  const kpis = (stats.kpis || {}) as Record<string, number>;
  const charts = (stats.charts || {}) as Record<string, Record<string, number> | Array<{ type: string; count: number }>>;
  const pending = (stats.pending || {}) as Record<string, number>;

  return (
    <div>
      <PageHeader
        title="Warehouse dashboard"
        description="Live quantities from inventory balances, not placeholder statistics."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/warehouse/receipts/new">Goods receipt</Link>
            </Button>
            <Button asChild className="min-h-11">
              <Link href="/warehouse/inventory">Open inventory</Link>
            </Button>
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total inventory" value={kpis.totalInventory} />
        <Metric label="Available stock" value={kpis.availableStock} />
        <Metric label="Quarantine" value={kpis.quarantineStock} />
        <Metric label="Blocked" value={kpis.blockedStock} />
        <Metric label="Rejected" value={kpis.rejectedStock} />
        <Metric label="Expired" value={kpis.expiredStock} />
        <Metric label="Near expiry" value={kpis.nearExpiry} />
        <Metric label="Low stock items" value={kpis.lowStock} />
        <Metric label="Warehouses" value={logistics.totalWarehouses} />
        <Metric label="Locations" value={logistics.totalLocations} />
        <Metric label="Pending put away" value={logistics.pendingPutAway} />
        <Metric label="Pending picks" value={logistics.pendingPicks} />
        <Metric label="Pending dispatches" value={logistics.pendingDispatches} />
        <Metric label="In-transit shipments" value={logistics.inTransitShipments} />
        <Metric label="Cold-chain shipments" value={logistics.coldChainShipments} />
        <Metric label="Active excursions" value={logistics.activeExcursions} />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Inventory by category">
          <BarBlock data={toChart(charts.byItemType, inventoryItemTypeOptions)} />
        </ChartCard>
        <ChartCard title="Inventory by warehouse">
          <BarBlock data={toChart(charts.byWarehouse)} />
        </ChartCard>
        <ChartCard title="Quality status distribution">
          <PieBlock data={toChart(charts.byQuality, qualityStatusOptions)} />
        </ChartCard>
        <ChartCard title="Stock movement">
          <BarBlock data={Array.isArray(charts.movement) ? charts.movement.map((row) => ({ name: row.type, value: row.count })) : []} />
        </ChartCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pending operations</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Metric label="Receipts" value={pending.receipts || 0} compact />
            <Metric label="Transfers" value={pending.transfers || 0} compact />
            <Metric label="Issues" value={pending.issues || 0} compact />
            <Metric label="Adjustments" value={pending.adjustments || 0} compact />
            <Metric label="Put away" value={logistics.pendingPutAway} compact />
            <Metric label="Picks" value={logistics.pendingPicks} compact />
            <Metric label="Dispatches" value={logistics.pendingDispatches} compact />
            <Metric label="Excursions" value={logistics.activeExcursions} compact />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Low stock (material master)</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length ? (
              <ul className="space-y-2 text-sm">
                {lowStock.slice(0, 8).map((row) => (
                  <li key={String(row.id)} className="flex justify-between gap-3">
                    <span>{String(row.materialCode)} · {String(row.materialName)}</span>
                    <span className="text-muted-foreground">{String(row.level)} · {String(row.quantity)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No materials are below configured minimum or reorder levels.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, compact }: { label: string; value?: number; compact?: boolean }) {
  return (
    <Card>
      <CardHeader className={compact ? "pb-1" : "pb-2"}>
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={compact ? "text-xl font-semibold" : "text-2xl font-semibold"}>{Number(value || 0).toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}
