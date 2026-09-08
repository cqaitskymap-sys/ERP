"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogisticsList } from "@/components/logistics/logistics-list";
import { LogisticsWorkflowActions } from "@/components/logistics/logistics-workflow";
import { getCustomerDistribution, getLogistics, getRecallDistribution, getWarehouse360 } from "@/lib/logistics/client";
import {
  cycleCountStatusOptions,
  excursionStatusOptions,
  labelFor,
  packStatusOptions,
  pickStatusOptions,
  putawayStatusOptions,
  returnStatusOptions,
  shipmentStatusOptions,
  workflowTone,
} from "@/lib/logistics/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

function StatusCell({ options, value }: { options: Array<{ label: string; value: string }>; value: unknown }) {
  return <StatusBadge label={labelFor(options, value)} tone={workflowTone(value)} />;
}

export function PutawayList() {
  return <LogisticsList title="Put away" description="Quarantine or released stock staged to a location. Confirmation updates inventory through the existing engine." resource="putaways" permission="warehousePutaway:read" createHref="/warehouse/putaway/new" createLabel="New put away" exportColumns={["putawayNumber", "warehouseId", "batchNumber", "quantity", "status"]} columns={[{ key: "putawayNumber", header: "Number" }, { key: "batchNumber", header: "Batch" }, { key: "quantity", header: "Qty" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={putawayStatusOptions} value={row.status} /> }]} rowHref={(row) => `/warehouse/putaway/${row.id}`} />;
}
export function MovementList() {
  return <LogisticsList title="Stock movements" description="STK-MOV numbered controlled movements. Completing a movement posts immutable ledger entries." resource="movements" permission="inventory:read" createHref="/warehouse/movements/new" createLabel="New movement" exportColumns={["movementNumber", "movementType", "batchNumber", "quantity", "status"]} columns={[{ key: "movementNumber", header: "Number" }, { key: "movementType", header: "Type" }, { key: "batchNumber", header: "Batch" }, { key: "status", header: "Status" }]} rowHref={(row) => `/warehouse/movements/${row.id}`} />;
}
export function PickListPage() {
  return <LogisticsList title="Picking" description="FEFO pick lists with server-side allocation and shelf-life checks." resource="picks" permission="warehousePicking:read" createHref="/warehouse/picking/new" createLabel="New pick" exportColumns={["pickNumber", "customerId", "productId", "quantity", "status"]} columns={[{ key: "pickNumber", header: "Number" }, { key: "productId", header: "Product" }, { key: "quantity", header: "Qty" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={pickStatusOptions} value={row.status} /> }]} rowHref={(row) => `/warehouse/picking/${row.id}`} />;
}
export function PackingList() {
  return <LogisticsList title="Packing" description="Packing records linked to verified picks." resource="packing" permission="warehousePacking:read" createHref="/warehouse/packing/new" createLabel="New packing" exportColumns={["packingNumber", "pickId", "status"]} columns={[{ key: "packingNumber", header: "Number" }, { key: "pickId", header: "Pick" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={packStatusOptions} value={row.status} /> }]} rowHref={(row) => `/warehouse/packing/${row.id}`} />;
}
export function ShipmentList() {
  return <LogisticsList title="Shipments" description="Outbound distribution. Dispatch consumes reserved inventory through the central engine." resource="shipments" permission="warehouseShipment:read" createHref="/warehouse/shipments/new" createLabel="New shipment" exportColumns={["shipmentNumber", "customerId", "status", "trackingNumber"]} columns={[{ key: "shipmentNumber", header: "Number" }, { key: "customerId", header: "Customer" }, { key: "trackingNumber", header: "Tracking" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={shipmentStatusOptions} value={row.status} /> }]} rowHref={(row) => `/warehouse/shipments/${row.id}`} />;
}
export function CustomerReturnList() {
  return <LogisticsList title="Customer / recall returns" description="Distribution returns stay in quarantine until authorized QA disposition. Internal material returns remain under Warehouse → Material Return." resource="returns" permission="warehouseCustomerReturn:read" createHref="/warehouse/customer-returns/new" createLabel="Log return" exportColumns={["returnNumber", "customerId", "batchNumber", "status"]} columns={[{ key: "returnNumber", header: "Number" }, { key: "batchNumber", header: "Batch" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={returnStatusOptions} value={row.status} /> }]} rowHref={(row) => `/warehouse/customer-returns/${row.id}`} />;
}
export function CycleCountList() {
  return <LogisticsList title="Cycle counts" description="Physical counts. Variance never writes inventory directly." resource="cycleCounts" permission="warehouseCycleCount:read" createHref="/warehouse/cycle-counts/new" createLabel="Plan count" exportColumns={["countNumber", "warehouseId", "variance", "status"]} columns={[{ key: "countNumber", header: "Number" }, { key: "variance", header: "Variance" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={cycleCountStatusOptions} value={row.status} /> }]} rowHref={(row) => `/warehouse/cycle-counts/${row.id}`} />;
}
export function ExcursionList() {
  return <LogisticsList title="Temperature excursions" description="Potential excursions. QA records the disposition. The software does not release or reject product." resource="excursions" permission="warehouseExcursion:read" exportColumns={["excursionNumber", "shipmentId", "temperature", "status"]} columns={[{ key: "excursionNumber", header: "Number" }, { key: "temperature", header: "Temp" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={excursionStatusOptions} value={row.status} /> }]} rowHref={(row) => `/warehouse/excursions/${row.id}`} />;
}
export function TemperatureList() {
  return <LogisticsList title="Temperature monitoring" description="Manual, import, or integration records with UTC timestamps." resource="temperatures" permission="warehouseColdchain:read" createHref="/warehouse/temperature/new" createLabel="Record reading" exportColumns={["timestamp", "temperature", "warehouseId", "shipmentId"]} columns={[{ key: "timestamp", header: "Time" }, { key: "temperature", header: "Temp" }, { key: "shipmentId", header: "Shipment" }]} rowHref={(row) => `/warehouse/temperature?id=${row.id}`} />;
}

export function LogisticsDetail({
  resource,
  id,
  permission,
  titleKey,
  statusOptions,
  actions,
}: {
  resource: string;
  id: string;
  permission: Permission;
  titleKey: string;
  statusOptions: Array<{ label: string; value: string }>;
  actions: Array<{ action: string; label: string; permission: Permission; requireReason?: boolean; variant?: "outline" | "destructive" | "default" }>;
}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    void getLogistics(resource, id).then((result) => setRecord(result.record)).catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) return <EmptyState title="Record not found" description={error || ""} />;

  return (
    <RequirePermission permission={permission}>
      <div>
        <PageHeader title={String(record[titleKey] || id)} description="Controlled warehouse logistics record." />
        <LogisticsWorkflowActions resource={resource} id={id} status={String(record.status)} statusOptions={statusOptions} actions={actions} onChanged={reload} />
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(record).filter(([key]) => !["searchIndex", "id", "_updateTime"].includes(key)).slice(0, 16).map(([key, value]) => (
            <Card key={key}>
              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{key}</CardTitle></CardHeader>
              <CardContent className="text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </RequirePermission>
  );
}

export function PutawayDetail({ id }: { id: string }) {
  return <LogisticsDetail resource="putaways" id={id} permission="warehousePutaway:read" titleKey="putawayNumber" statusOptions={putawayStatusOptions} actions={[{ action: "assigned", label: "Assign", permission: "warehousePutaway:update" }, { action: "in_progress", label: "Start", permission: "warehousePutaway:update" }, { action: "confirm", label: "Confirm put away", permission: "warehousePutaway:confirm", requireReason: true }]} />;
}
export function MovementDetail({ id }: { id: string }) {
  return <LogisticsDetail resource="movements" id={id} permission="inventory:read" titleKey="movementNumber" statusOptions={[{ label: "Draft", value: "draft" }, { label: "Completed", value: "completed" }]} actions={[{ action: "requested", label: "Request", permission: "inventory:update" }, { action: "approved", label: "Approve", permission: "inventory:update", requireReason: true }, { action: "complete", label: "Complete movement", permission: "inventory:update", requireReason: true }]} />;
}
export function PickDetail({ id }: { id: string }) {
  return <LogisticsDetail resource="picks" id={id} permission="warehousePicking:read" titleKey="pickNumber" statusOptions={pickStatusOptions} actions={[{ action: "assigned", label: "Assign", permission: "warehousePicking:assign" }, { action: "in_progress", label: "Start", permission: "warehousePicking:update" }, { action: "picked", label: "Mark picked", permission: "warehousePicking:update" }, { action: "confirm", label: "Verify pick", permission: "warehousePicking:confirm", requireReason: true }]} />;
}
export function PackingDetail({ id }: { id: string }) {
  return <LogisticsDetail resource="packing" id={id} permission="warehousePacking:read" titleKey="packingNumber" statusOptions={packStatusOptions} actions={[{ action: "packing", label: "Start packing", permission: "warehousePacking:update" }, { action: "confirm", label: "Confirm pack", permission: "warehousePacking:confirm", requireReason: true }]} />;
}
export function ShipmentDetail({ id }: { id: string }) {
  return <LogisticsDetail resource="shipments" id={id} permission="warehouseShipment:read" titleKey="shipmentNumber" statusOptions={shipmentStatusOptions} actions={[{ action: "ready", label: "Mark ready", permission: "warehouseShipment:update" }, { action: "packed", label: "Mark packed", permission: "warehouseShipment:update" }, { action: "dispatch", label: "Dispatch", permission: "warehouseShipment:dispatch", requireReason: true }, { action: "deliver", label: "Confirm delivery", permission: "warehouseShipment:close", requireReason: true }]} />;
}
export function CustomerReturnDetail({ id }: { id: string }) {
  return <LogisticsDetail resource="returns" id={id} permission="warehouseCustomerReturn:read" titleKey="returnNumber" statusOptions={returnStatusOptions} actions={[{ action: "approved", label: "Approve request", permission: "warehouseCustomerReturn:approve", requireReason: true }, { action: "receive", label: "Receive to quarantine", permission: "warehouseCustomerReturn:update", requireReason: true }, { action: "qa_review", label: "Send to QA review", permission: "warehouseCustomerReturn:update" }]} />;
}
export function CycleCountDetail({ id }: { id: string }) {
  return <LogisticsDetail resource="cycleCounts" id={id} permission="warehouseCycleCount:read" titleKey="countNumber" statusOptions={cycleCountStatusOptions} actions={[{ action: "assigned", label: "Assign", permission: "warehouseCycleCount:update" }, { action: "counting", label: "Start count", permission: "warehouseCycleCount:update" }, { action: "verification", label: "Send to verification", permission: "warehouseCycleCount:update" }, { action: "approve", label: "Approve count", permission: "warehouseCycleCount:approve", requireReason: true }]} />;
}
export function ExcursionDetail({ id }: { id: string }) {
  return <LogisticsDetail resource="excursions" id={id} permission="warehouseExcursion:read" titleKey="excursionNumber" statusOptions={excursionStatusOptions} actions={[{ action: "detected", label: "Confirm detection", permission: "warehouseExcursion:update" }, { action: "qa_assessment", label: "QA assessment", permission: "warehouseExcursion:update" }, { action: "decide", label: "Record QA decision", permission: "warehouseExcursion:approve", requireReason: true }]} />;
}

export function WarehouseSitesPage() {
  return (
    <RequirePermission permission="warehouse:read">
      <div>
        <PageHeader title="Warehouses" description="Existing warehouse master records. Types are configurable. A second warehouse master is not created." actions={<Button asChild className="min-h-11"><Link href="/admin/warehouses">Open warehouse master</Link></Button>} />
        <p className="text-sm text-muted-foreground">Use the master to create or update warehouses. Open a warehouse 360 from the master record ID via /warehouse/warehouses/[id].</p>
      </div>
    </RequirePermission>
  );
}

export function LocationSitesPage() {
  return (
    <RequirePermission permission="warehouseLocation:read">
      <div>
        <PageHeader title="Locations / bins" description="Existing storage location master (zone → aisle → rack → shelf → bin). Do not create a second location engine." actions={<Button asChild className="min-h-11"><Link href="/admin/locations">Open location master</Link></Button>} />
      </div>
    </RequirePermission>
  );
}

export function ReceivingWorkspace() {
  return (
    <RequirePermission permission="goodsReceipt:read">
      <div>
        <PageHeader title="Receiving" description="Purchase order receiving reuses the existing Goods Receipt engine. Incoming stock starts in quarantine." actions={<Button asChild className="min-h-11"><Link href="/warehouse/receipts/new">New goods receipt</Link></Button>} />
        <p className="text-sm text-muted-foreground">Open the existing receipts workspace for PO, batch, expiry, CoA, and QC request handling.</p>
        <Button asChild variant="outline" className="mt-4 min-h-11"><Link href="/warehouse/receipts">Open goods receipts</Link></Button>
      </div>
    </RequirePermission>
  );
}

export function ReconciliationPage() {
  return (
    <RequirePermission permission="warehouseReconciliation:read">
      <div>
        <PageHeader title="Stock reconciliation" description="Cycle-count variances create reconciliation requests. Inventory changes only after authorized adjustment through the existing adjustment engine." actions={<Button asChild className="min-h-11"><Link href="/warehouse/adjustments">Open adjustments</Link></Button>} />
        <CycleCountList />
      </div>
    </RequirePermission>
  );
}

export function Warehouse360Page({ id }: { id: string }) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getWarehouse360(id).then((result) => { setRecord(result.record as Row); setExtra(result.extra || {}); }).catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) return <EmptyState title="Warehouse not found" description={error || ""} />;

  const asRows = (key: string) => (extra[key] as Row[]) || [];
  const utilization = (extra.utilization || {}) as Record<string, number>;

  return (
    <RequirePermission permission="warehouse:read">
      <div>
        <PageHeader title={String(record.warehouseName || id)} description={`Warehouse 360 · ${String(record.warehouseCode || "")}`} />
        <div className="mb-6 grid gap-3 md:grid-cols-4">
          <Info label="Type" value={record.warehouseType} />
          <Info label="Utilization %" value={utilization.utilizationPercent} />
          <Info label="Available locations" value={utilization.availableLocations} />
          <Info label="Blocked locations" value={utilization.blockedLocations} />
        </div>
        <Tabs defaultValue="inventory">
          <TabsList className="mb-4 flex flex-wrap">
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="picks">Picks</TabsTrigger>
            <TabsTrigger value="shipments">Shipments</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
          </TabsList>
          <TabsContent value="inventory">{asRows("inventory").map((row) => <div key={row.id} className="mb-2 rounded-lg border p-3 text-sm">{String(row.itemName)} · {String(row.batchNumber)} · {String(row.availableQuantity)}</div>)}</TabsContent>
          <TabsContent value="locations">{asRows("locations").map((row) => <div key={row.id} className="mb-2 rounded-lg border p-3 text-sm">{String(row.locationCode)} · {String(row.locationType)}</div>)}</TabsContent>
          <TabsContent value="picks">{asRows("picks").map((row) => <div key={row.id} className="mb-2 rounded-lg border p-3 text-sm">{String(row.pickNumber)} · {String(row.status)}</div>)}</TabsContent>
          <TabsContent value="shipments">{asRows("shipments").map((row) => <div key={row.id} className="mb-2 rounded-lg border p-3 text-sm">{String(row.shipmentNumber)} · {String(row.status)}</div>)}</TabsContent>
          <TabsContent value="returns">{asRows("returns").map((row) => <div key={row.id} className="mb-2 rounded-lg border p-3 text-sm">{String(row.returnNumber)} · {String(row.status)}</div>)}</TabsContent>
        </Tabs>
      </div>
    </RequirePermission>
  );
}

export function CustomerDistributionPage({ id }: { id: string }) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getCustomerDistribution(id).then((result) => { setRecord(result.record as Row); setExtra(result.extra || {}); }).catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) return <EmptyState title="Customer not found" description={error || ""} />;

  return (
    <RequirePermission permission="warehouse:read">
      <div>
        <PageHeader title={String(record.customerName || record.name || id)} description="Customer distribution 360 from existing Customer Master and shipment history." />
        <h3 className="mb-2 text-sm font-medium">Shipments</h3>
        {((extra.shipments as Row[]) || []).map((row) => <div key={row.id} className="mb-2 rounded-lg border p-3 text-sm">{String(row.shipmentNumber)} · {String(row.status)}</div>)}
      </div>
    </RequirePermission>
  );
}

export function RecallDistributionPage() {
  const [batchNumber, setBatchNumber] = useState("");
  const [extra, setExtra] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <RequirePermission permission="warehouse:read">
      <div>
        <PageHeader title="Recall distribution" description="Trace a batch to shipments, customers, and returns. This does not initiate a recall — Phase 13 remains the recall decision engine." />
        <div className="mb-4 flex gap-2">
          <Input className="min-h-11 max-w-sm" placeholder="Batch number" value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} />
          <Button className="min-h-11" onClick={() => void getRecallDistribution(batchNumber).then((result) => { setExtra(result.extra || {}); setError(null); }).catch((err) => setError(publicMasterError(err)))}>Search</Button>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {extra ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Distributed shipment lines: {((extra.shipments as Row[]) || []).length}. Returns: {((extra.returns as Row[]) || []).length}.</p>
            {((extra.shipments as Row[]) || []).map((row) => <div key={row.id} className="rounded-lg border p-3 text-sm">{String(row.shipmentId || row.id)} · {String(row.quantity || row.allocatedQuantity)}</div>)}
          </div>
        ) : null}
      </div>
    </RequirePermission>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent className="text-sm">{String(value ?? "—")}</CardContent>
    </Card>
  );
}
