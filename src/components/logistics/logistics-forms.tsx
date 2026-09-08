"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { MasterPick } from "@/components/warehouse/master-pick";
import { ScanInput } from "@/components/logistics/scan-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createLogistics } from "@/lib/logistics/client";
import { movementTypeOptions, returnSourceOptions, temperatureSourceOptions } from "@/lib/logistics/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function FormShell({ permission, title, description, children, onSubmit }: { permission: Permission; title: string; description: string; children: ReactNode; onSubmit: () => Promise<void> }) {
  return (
    <RequirePermission permission={permission}>
      <div>
        <PageHeader title={title} description={description} />
        <div className="mb-6 grid gap-3 md:grid-cols-2">{children}</div>
        <Button className="min-h-11" onClick={() => void onSubmit().catch((error) => toast.error("Unable to save", publicMasterError(error)))}>Save</Button>
      </div>
    </RequirePermission>
  );
}

export function PutawayForm() {
  const router = useRouter();
  const [form, setForm] = useState({ warehouseId: "", locationId: "", sourceLocationId: "", itemType: "material", materialId: "", productId: "", batchNumber: "", quantity: "1" });
  return (
    <FormShell permission="warehousePutaway:create" title="Put away" description="Moves stock to a compatible location. Quantity changes go through the existing inventory engine." onSubmit={async () => {
      const result = await createLogistics("putaways", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Put away created");
      router.push(`/warehouse/putaway/${result.id}`);
    }}>
      <MasterPick entity="warehouses" label="Warehouse" value={form.warehouseId} onChange={(warehouseId) => setForm({ ...form, warehouseId })} required />
      <MasterPick entity="storageLocations" label="Destination location" value={form.locationId} onChange={(locationId) => setForm({ ...form, locationId })} required />
      <MasterPick entity="materials" label="Material" value={form.materialId} onChange={(materialId) => setForm({ ...form, materialId, itemType: "material" })} />
      <ScanInput label="Batch" value={form.batchNumber} onChange={(batchNumber) => setForm({ ...form, batchNumber })} placeholder="Scan or type batch" />
      <Field label="Quantity"><Input className="min-h-11" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
    </FormShell>
  );
}

export function MovementForm() {
  const router = useRouter();
  const [form, setForm] = useState({ movementType: "bin_transfer", sourceWarehouseId: "", sourceLocationId: "", destinationWarehouseId: "", destinationLocationId: "", itemType: "material", materialId: "", batchNumber: "", quantity: "1", reason: "" });
  return (
    <FormShell permission="inventory:update" title="Stock movement" description="Controlled movement with a server-generated STK-MOV number. Inventory quantities are never edited in the UI." onSubmit={async () => {
      const result = await createLogistics("movements", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Movement saved");
      router.push(`/warehouse/movements/${result.id}`);
    }}>
      <Field label="Type"><Select value={form.movementType} onValueChange={(movementType) => setForm({ ...form, movementType })}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{movementTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
      <MasterPick entity="warehouses" label="Source warehouse" value={form.sourceWarehouseId} onChange={(sourceWarehouseId) => setForm({ ...form, sourceWarehouseId })} required />
      <MasterPick entity="storageLocations" label="Source location" value={form.sourceLocationId} onChange={(sourceLocationId) => setForm({ ...form, sourceLocationId })} required />
      <MasterPick entity="warehouses" label="Destination warehouse" value={form.destinationWarehouseId} onChange={(destinationWarehouseId) => setForm({ ...form, destinationWarehouseId })} required />
      <MasterPick entity="storageLocations" label="Destination location" value={form.destinationLocationId} onChange={(destinationLocationId) => setForm({ ...form, destinationLocationId })} required />
      <MasterPick entity="materials" label="Material" value={form.materialId} onChange={(materialId) => setForm({ ...form, materialId })} />
      <ScanInput label="Batch" value={form.batchNumber} onChange={(batchNumber) => setForm({ ...form, batchNumber })} />
      <Field label="Quantity"><Input className="min-h-11" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Reason"><Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function PickForm() {
  const router = useRouter();
  const [form, setForm] = useState({ warehouseId: "", customerId: "", orderId: "", productId: "", quantity: "1", minShelfLifeMonths: "0", dueDate: "" });
  return (
    <FormShell permission="warehousePicking:create" title="Create pick list" description="Server-side FEFO allocation. Expired, held, rejected, and short-shelf-life stock is blocked." onSubmit={async () => {
      const result = await createLogistics("picks", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Pick list created");
      router.push(`/warehouse/picking/${result.id}`);
    }}>
      <MasterPick entity="warehouses" label="Warehouse" value={form.warehouseId} onChange={(warehouseId) => setForm({ ...form, warehouseId })} required />
      <MasterPick entity="customers" label="Customer" value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} />
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} required />
      <Field label="Quantity"><Input className="min-h-11" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
      <Field label="Minimum remaining shelf life (months)"><Input className="min-h-11" value={form.minShelfLifeMonths} onChange={(event) => setForm({ ...form, minShelfLifeMonths: event.target.value })} /></Field>
      <Field label="Order reference"><Input className="min-h-11" value={form.orderId} onChange={(event) => setForm({ ...form, orderId: event.target.value })} /></Field>
    </FormShell>
  );
}

export function PackingForm() {
  const router = useRouter();
  const [form, setForm] = useState({ pickId: "", packageType: "carton", packageCount: "1", packagingInstructions: "" });
  return (
    <FormShell permission="warehousePacking:create" title="Packing record" description="Packing numbers are generated as PACK-YYYY-#####." onSubmit={async () => {
      const result = await createLogistics("packing", form);
      toast.success("Packing opened");
      router.push(`/warehouse/packing/${result.id}`);
    }}>
      <Field label="Pick ID"><Input className="min-h-11" value={form.pickId} onChange={(event) => setForm({ ...form, pickId: event.target.value })} /></Field>
      <Field label="Package type"><Input className="min-h-11" value={form.packageType} onChange={(event) => setForm({ ...form, packageType: event.target.value })} /></Field>
      <Field label="Package count"><Input className="min-h-11" value={form.packageCount} onChange={(event) => setForm({ ...form, packageCount: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Instructions"><Textarea value={form.packagingInstructions} onChange={(event) => setForm({ ...form, packagingInstructions: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function ShipmentForm() {
  const router = useRouter();
  const [form, setForm] = useState({ customerId: "", warehouseId: "", pickId: "", packingId: "", carrier: "", trackingNumber: "", expectedDeliveryDate: "", temperatureControlled: false, minTemperature: "2", maxTemperature: "8" });
  return (
    <FormShell permission="warehouseShipment:create" title="Create shipment" description="Shipment numbers are generated as SHP-YYYY-#####. Nothing is sent to a carrier automatically." onSubmit={async () => {
      const result = await createLogistics("shipments", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Shipment created");
      router.push(`/warehouse/shipments/${result.id}`);
    }}>
      <MasterPick entity="customers" label="Customer" value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} required />
      <MasterPick entity="warehouses" label="Warehouse" value={form.warehouseId} onChange={(warehouseId) => setForm({ ...form, warehouseId })} required />
      <Field label="Pick ID"><Input className="min-h-11" value={form.pickId} onChange={(event) => setForm({ ...form, pickId: event.target.value })} /></Field>
      <Field label="Packing ID"><Input className="min-h-11" value={form.packingId} onChange={(event) => setForm({ ...form, packingId: event.target.value })} /></Field>
      <Field label="Carrier"><Input className="min-h-11" value={form.carrier} onChange={(event) => setForm({ ...form, carrier: event.target.value })} /></Field>
      <ScanInput label="Tracking number" value={form.trackingNumber} onChange={(trackingNumber) => setForm({ ...form, trackingNumber })} />
      <Field label="Expected delivery"><Input className="min-h-11" type="date" value={form.expectedDeliveryDate} onChange={(event) => setForm({ ...form, expectedDeliveryDate: event.target.value })} /></Field>
    </FormShell>
  );
}

export function CustomerReturnForm() {
  const router = useRouter();
  const [form, setForm] = useState({ customerId: "", warehouseId: "", locationId: "", productId: "", batchNumber: "", quantity: "1", reason: "other", remarks: "" });
  return (
    <FormShell permission="warehouseCustomerReturn:create" title="Customer / distribution return" description="Returned product is received into quarantine. It does not become available stock. Distinct from internal material returns." onSubmit={async () => {
      const result = await createLogistics("returns", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Return logged");
      router.push(`/warehouse/customer-returns/${result.id}`);
    }}>
      <MasterPick entity="customers" label="Customer" value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} required />
      <MasterPick entity="warehouses" label="Warehouse" value={form.warehouseId} onChange={(warehouseId) => setForm({ ...form, warehouseId })} required />
      <MasterPick entity="storageLocations" label="Quarantine location" value={form.locationId} onChange={(locationId) => setForm({ ...form, locationId })} required />
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} required />
      <ScanInput label="Batch" value={form.batchNumber} onChange={(batchNumber) => setForm({ ...form, batchNumber })} />
      <Field label="Quantity"><Input className="min-h-11" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
      <Field label="Reason"><Select value={form.reason} onValueChange={(reason) => setForm({ ...form, reason })}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{returnSourceOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
    </FormShell>
  );
}

export function CycleCountForm() {
  const router = useRouter();
  const [form, setForm] = useState({ warehouseId: "", locationId: "", materialId: "", batchNumber: "", systemQuantity: "0", countedQuantity: "" });
  return (
    <FormShell permission="warehouseCycleCount:create" title="Cycle count" description="Variance does not change inventory. A reconciliation request is created for authorized adjustment." onSubmit={async () => {
      const result = await createLogistics("cycleCounts", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Count planned");
      router.push(`/warehouse/cycle-counts/${result.id}`);
    }}>
      <MasterPick entity="warehouses" label="Warehouse" value={form.warehouseId} onChange={(warehouseId) => setForm({ ...form, warehouseId })} required />
      <MasterPick entity="storageLocations" label="Location" value={form.locationId} onChange={(locationId) => setForm({ ...form, locationId })} />
      <MasterPick entity="materials" label="Material" value={form.materialId} onChange={(materialId) => setForm({ ...form, materialId })} />
      <ScanInput label="Batch" value={form.batchNumber} onChange={(batchNumber) => setForm({ ...form, batchNumber })} />
      <Field label="System quantity"><Input className="min-h-11" value={form.systemQuantity} onChange={(event) => setForm({ ...form, systemQuantity: event.target.value })} /></Field>
      <Field label="Counted quantity"><Input className="min-h-11" value={form.countedQuantity} onChange={(event) => setForm({ ...form, countedQuantity: event.target.value })} /></Field>
    </FormShell>
  );
}

export function TemperatureForm() {
  const router = useRouter();
  const [form, setForm] = useState({ warehouseId: "", shipmentId: "", deviceId: "", temperature: "", humidity: "", unit: "C", source: "manual" });
  return (
    <FormShell permission="warehouseColdchain:create" title="Temperature record" description="UTC timestamps. Out-of-range readings open a potential excursion for QA — the software does not decide disposition." onSubmit={async () => {
      const result = await createLogistics("temperatures", form);
      toast.success("Temperature recorded");
      router.push(`/warehouse/temperature`);
      void result;
    }}>
      <MasterPick entity="warehouses" label="Warehouse" value={form.warehouseId} onChange={(warehouseId) => setForm({ ...form, warehouseId })} />
      <Field label="Shipment ID"><Input className="min-h-11" value={form.shipmentId} onChange={(event) => setForm({ ...form, shipmentId: event.target.value })} /></Field>
      <Field label="Device ID"><Input className="min-h-11" value={form.deviceId} onChange={(event) => setForm({ ...form, deviceId: event.target.value })} /></Field>
      <Field label="Temperature"><Input className="min-h-11" value={form.temperature} onChange={(event) => setForm({ ...form, temperature: event.target.value })} /></Field>
      <Field label="Humidity"><Input className="min-h-11" value={form.humidity} onChange={(event) => setForm({ ...form, humidity: event.target.value })} /></Field>
      <Field label="Source"><Select value={form.source} onValueChange={(source) => setForm({ ...form, source })}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{temperatureSourceOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
    </FormShell>
  );
}
