"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { MasterPick } from "@/components/warehouse/master-pick";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createWarehouse } from "@/lib/inventory/client";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

const emptyItem = {
  materialId: "",
  batchNumber: "",
  lotNumber: "",
  supplierBatchNumber: "",
  manufacturerBatchNumber: "",
  quantity: "",
  uom: "",
  manufacturingDate: "",
  expiryDate: "",
  retestDate: "",
  packageCount: "",
  remarks: "",
};

export function ReceiptForm() {
  return (
    <RequirePermission permission="goodsReceipt:create">
      <FormInner />
    </RequirePermission>
  );
}

function FormInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    receiptDate: new Date().toISOString().slice(0, 10),
    supplierId: "",
    sourceReference: "",
    purchaseOrderId: "",
    warehouseId: "",
    receivingLocationId: "",
    remarks: "",
  });
  const [items, setItems] = useState([emptyItem]);

  async function submit() {
    try {
      const result = await createWarehouse("receipts", {
        ...header,
        itemType: "material",
        idempotencyKey: crypto.randomUUID(),
        items: items.map((item) => ({
          ...item,
          itemType: "material",
          quantity: Number(item.quantity),
          packageCount: item.packageCount ? Number(item.packageCount) : undefined,
        })),
      });
      toast.success("Draft goods receipt created");
      router.push(`/warehouse/receipts/${result.id}`);
    } catch (error) {
      toast.error("Unable to save receipt", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader
        title="New goods receipt"
        description="Incoming pharmaceutical stock is received into quarantine. Approval is a later QA step."
      />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Field label="Receipt date">
          <Input className="min-h-11" type="date" value={header.receiptDate} onChange={(event) => setHeader({ ...header, receiptDate: event.target.value })} />
        </Field>
        <MasterPick entity="suppliers" label="Supplier" value={header.supplierId} onChange={(supplierId) => setHeader({ ...header, supplierId })} />
        <Field label="Purchase order ID">
          <Input className="min-h-11" value={header.purchaseOrderId} onChange={(event) => setHeader({ ...header, purchaseOrderId: event.target.value })} placeholder="Optional approved PO" />
        </Field>
        <Field label="Source reference">
          <Input className="min-h-11" value={header.sourceReference} onChange={(event) => setHeader({ ...header, sourceReference: event.target.value })} />
        </Field>
        <MasterPick entity="warehouses" label="Warehouse" required value={header.warehouseId} onChange={(warehouseId) => setHeader({ ...header, warehouseId, receivingLocationId: "" })} />
        <MasterPick entity="storageLocations" label="Receiving location" required warehouseId={header.warehouseId} value={header.receivingLocationId} onChange={(receivingLocationId) => setHeader({ ...header, receivingLocationId })} />
        <Field label="Remarks">
          <Textarea value={header.remarks} onChange={(event) => setHeader({ ...header, remarks: event.target.value })} />
        </Field>
      </div>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
            <MasterPick entity="materials" label="Material" required value={item.materialId} onChange={(materialId) => updateItem(index, { materialId })} />
            <Field label="Batch number">
              <Input className="min-h-11" value={item.batchNumber} onChange={(event) => updateItem(index, { batchNumber: event.target.value })} />
            </Field>
            <Field label="Quantity">
              <Input className="min-h-11" type="number" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} />
            </Field>
            <MasterPick entity="uoms" label="UOM" required value={item.uom} onChange={(uom) => updateItem(index, { uom })} />
            <Field label="Lot">
              <Input className="min-h-11" value={item.lotNumber} onChange={(event) => updateItem(index, { lotNumber: event.target.value })} />
            </Field>
            <Field label="Supplier batch">
              <Input className="min-h-11" value={item.supplierBatchNumber} onChange={(event) => updateItem(index, { supplierBatchNumber: event.target.value })} />
            </Field>
            <Field label="Manufacturer batch">
              <Input className="min-h-11" value={item.manufacturerBatchNumber} onChange={(event) => updateItem(index, { manufacturerBatchNumber: event.target.value })} />
            </Field>
            <Field label="Mfg date">
              <Input className="min-h-11" type="date" value={item.manufacturingDate} onChange={(event) => updateItem(index, { manufacturingDate: event.target.value })} />
            </Field>
            <Field label="Expiry">
              <Input className="min-h-11" type="date" value={item.expiryDate} onChange={(event) => updateItem(index, { expiryDate: event.target.value })} />
            </Field>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" onClick={() => setItems([...items, emptyItem])}>
          Add item
        </Button>
        <Button className="min-h-11" onClick={() => void submit()}>
          Save draft
        </Button>
      </div>
    </div>
  );

  function updateItem(index: number, patch: Partial<typeof emptyItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
