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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createProcurement } from "@/lib/procurement/client";
import { priorityOptions, selectionReasonOptions } from "@/lib/procurement/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

const emptyPrItem = {
  materialId: "",
  description: "",
  requiredQuantity: "",
  uom: "",
  requiredDate: "",
  preferredVendorId: "",
  specificationReference: "",
  purpose: "",
  remarks: "",
};

export function RequisitionForm() {
  return (
    <RequirePermission permission="purchaseRequisition:create">
      <PrInner />
    </RequirePermission>
  );
}

function PrInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    plantId: "",
    departmentId: "",
    requiredDate: new Date().toISOString().slice(0, 10),
    priority: "normal",
    purpose: "",
    remarks: "",
  });
  const [items, setItems] = useState([emptyPrItem]);

  async function submit() {
    try {
      const result = await createProcurement("requisitions", {
        ...header,
        idempotencyKey: crypto.randomUUID(),
        items: items.map((item) => ({ ...item, requiredQuantity: Number(item.requiredQuantity) })),
      });
      toast.success("Draft purchase requisition created");
      router.push(`/procurement/requisitions/${result.id}`);
    } catch (error) {
      toast.error("Unable to save requisition", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New purchase requisition" description="Request materials using Material Master IDs. Status starts as Draft." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <MasterPick entity="plants" label="Plant" required value={header.plantId} onChange={(plantId) => setHeader({ ...header, plantId })} />
        <MasterPick entity="departments" label="Department" value={header.departmentId} onChange={(departmentId) => setHeader({ ...header, departmentId })} />
        <Field label="Required date">
          <Input className="min-h-11" type="date" value={header.requiredDate} onChange={(event) => setHeader({ ...header, requiredDate: event.target.value })} />
        </Field>
        <Field label="Priority">
          <Select value={header.priority} onValueChange={(priority) => setHeader({ ...header, priority })}>
            <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {priorityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Purpose">
          <Input className="min-h-11" value={header.purpose} onChange={(event) => setHeader({ ...header, purpose: event.target.value })} />
        </Field>
        <Field label="Remarks">
          <Textarea value={header.remarks} onChange={(event) => setHeader({ ...header, remarks: event.target.value })} />
        </Field>
      </div>
      <LineEditor
        items={items}
        onChange={setItems}
        render={(item, index, update) => (
          <>
            <MasterPick entity="materials" label="Material" required value={item.materialId} onChange={(materialId) => update(index, { materialId })} />
            <Field label="Quantity">
              <Input className="min-h-11" type="number" value={item.requiredQuantity} onChange={(event) => update(index, { requiredQuantity: event.target.value })} />
            </Field>
            <MasterPick entity="uoms" label="UOM" required value={item.uom} onChange={(uom) => update(index, { uom })} />
            <MasterPick entity="vendors" label="Preferred vendor" value={item.preferredVendorId} onChange={(preferredVendorId) => update(index, { preferredVendorId })} />
          </>
        )}
      />
      <Button className="mt-4 min-h-11" onClick={() => void submit()}>Save draft</Button>
    </div>
  );
}

export function RfqForm() {
  return (
    <RequirePermission permission="rfq:create">
      <RfqInner />
    </RequirePermission>
  );
}

function RfqInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    requisitionId: "",
    responseDueDate: new Date().toISOString().slice(0, 10),
    currency: "INR",
    remarks: "",
  });
  const [vendorIds, setVendorIds] = useState<string[]>([""]);

  async function submit() {
    try {
      const result = await createProcurement("rfqs", {
        ...header,
        vendorIds: vendorIds.filter(Boolean),
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("Draft RFQ created from approved PR");
      router.push(`/procurement/rfqs/${result.id}`);
    } catch (error) {
      toast.error("Unable to save RFQ", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New RFQ" description="Create a request for quotation from an approved purchase requisition. Only registered vendors can be invited." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Field label="Approved PR ID">
          <Input className="min-h-11" value={header.requisitionId} onChange={(event) => setHeader({ ...header, requisitionId: event.target.value })} placeholder="Purchase requisition ID" />
        </Field>
        <Field label="Response due">
          <Input className="min-h-11" type="date" value={header.responseDueDate} onChange={(event) => setHeader({ ...header, responseDueDate: event.target.value })} />
        </Field>
        <Field label="Currency">
          <Input className="min-h-11" value={header.currency} onChange={(event) => setHeader({ ...header, currency: event.target.value })} />
        </Field>
        <Field label="Remarks">
          <Textarea value={header.remarks} onChange={(event) => setHeader({ ...header, remarks: event.target.value })} />
        </Field>
      </div>
      <div className="space-y-3">
        {vendorIds.map((vendorId, index) => (
          <MasterPick
            key={index}
            entity="vendors"
            label={`Vendor ${index + 1}`}
            required
            value={vendorId}
            onChange={(value) => setVendorIds((current) => current.map((item, i) => (i === index ? value : item)))}
          />
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="outline" className="min-h-11" onClick={() => setVendorIds((current) => [...current, ""])}>Add vendor</Button>
        <Button className="min-h-11" onClick={() => void submit()}>Save draft RFQ</Button>
      </div>
    </div>
  );
}

const emptyQuoteItem = {
  materialId: "",
  quotedQuantity: "",
  uom: "",
  unitPrice: "",
  discount: "0",
  tax: "0",
  freight: "0",
  otherCharges: "0",
  deliveryDays: "",
  specificationCompliance: "yes",
  remarks: "",
};

export function QuotationForm() {
  return (
    <RequirePermission permission="quotation:create">
      <QuoteInner />
    </RequirePermission>
  );
}

function QuoteInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    rfqId: "",
    vendorId: "",
    quotationDate: new Date().toISOString().slice(0, 10),
    validUntil: new Date().toISOString().slice(0, 10),
    currency: "INR",
    paymentTerms: "",
    deliveryTerms: "",
    leadTime: "",
    remarks: "",
  });
  const [items, setItems] = useState([emptyQuoteItem]);

  async function submit() {
    try {
      const result = await createProcurement("quotations", {
        ...header,
        leadTime: Number(header.leadTime || 0),
        idempotencyKey: crypto.randomUUID(),
        items: items.map((item) => ({
          ...item,
          quotedQuantity: Number(item.quotedQuantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount || 0),
          tax: Number(item.tax || 0),
          freight: Number(item.freight || 0),
          otherCharges: Number(item.otherCharges || 0),
          deliveryDays: Number(item.deliveryDays || 0),
        })),
      });
      toast.success("Vendor quotation recorded");
      router.push(`/procurement/quotations/${result.id}`);
    } catch (error) {
      toast.error("Unable to save quotation", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="Record vendor quotation" description="Totals are calculated on the server. Client figures are not trusted." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Field label="RFQ ID">
          <Input className="min-h-11" value={header.rfqId} onChange={(event) => setHeader({ ...header, rfqId: event.target.value })} />
        </Field>
        <MasterPick entity="vendors" label="Vendor" required value={header.vendorId} onChange={(vendorId) => setHeader({ ...header, vendorId })} />
        <Field label="Quotation date">
          <Input className="min-h-11" type="date" value={header.quotationDate} onChange={(event) => setHeader({ ...header, quotationDate: event.target.value })} />
        </Field>
        <Field label="Valid until">
          <Input className="min-h-11" type="date" value={header.validUntil} onChange={(event) => setHeader({ ...header, validUntil: event.target.value })} />
        </Field>
        <Field label="Payment terms">
          <Input className="min-h-11" value={header.paymentTerms} onChange={(event) => setHeader({ ...header, paymentTerms: event.target.value })} />
        </Field>
        <Field label="Lead time (days)">
          <Input className="min-h-11" type="number" value={header.leadTime} onChange={(event) => setHeader({ ...header, leadTime: event.target.value })} />
        </Field>
      </div>
      <LineEditor
        items={items}
        onChange={setItems}
        render={(item, index, update) => (
          <>
            <MasterPick entity="materials" label="Material" required value={item.materialId} onChange={(materialId) => update(index, { materialId })} />
            <Field label="Qty"><Input className="min-h-11" type="number" value={item.quotedQuantity} onChange={(event) => update(index, { quotedQuantity: event.target.value })} /></Field>
            <MasterPick entity="uoms" label="UOM" required value={item.uom} onChange={(uom) => update(index, { uom })} />
            <Field label="Unit price"><Input className="min-h-11" type="number" value={item.unitPrice} onChange={(event) => update(index, { unitPrice: event.target.value })} /></Field>
            <Field label="Discount"><Input className="min-h-11" type="number" value={item.discount} onChange={(event) => update(index, { discount: event.target.value })} /></Field>
            <Field label="Tax"><Input className="min-h-11" type="number" value={item.tax} onChange={(event) => update(index, { tax: event.target.value })} /></Field>
          </>
        )}
      />
      <Button className="mt-4 min-h-11" onClick={() => void submit()}>Save quotation</Button>
    </div>
  );
}

const emptyPoItem = {
  materialId: "",
  description: "",
  orderedQuantity: "",
  uom: "",
  unitPrice: "",
  discount: "0",
  tax: "0",
  freight: "0",
  expectedDeliveryDate: "",
  remarks: "",
};

export function PurchaseOrderForm() {
  return (
    <RequirePermission permission="purchaseOrder:create">
      <PoInner />
    </RequirePermission>
  );
}

function PoInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    vendorId: "",
    plantId: "",
    warehouseId: "",
    requisitionId: "",
    rfqId: "",
    quotationId: "",
    selectionId: "",
    poDate: new Date().toISOString().slice(0, 10),
    expectedDeliveryDate: new Date().toISOString().slice(0, 10),
    currency: "INR",
    paymentTerms: "",
    deliveryTerms: "",
    overReceiptTolerancePercent: "0",
    remarks: "",
  });
  const [items, setItems] = useState([emptyPoItem]);

  async function submit() {
    try {
      const result = await createProcurement("orders", {
        ...header,
        overReceiptTolerancePercent: Number(header.overReceiptTolerancePercent || 0),
        idempotencyKey: crypto.randomUUID(),
        items: items.map((item) => ({
          ...item,
          orderedQuantity: Number(item.orderedQuantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount || 0),
          tax: Number(item.tax || 0),
          freight: Number(item.freight || 0),
        })),
      });
      toast.success("Draft purchase order created");
      router.push(`/procurement/orders/${result.id}`);
    } catch (error) {
      toast.error("Unable to save purchase order", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New purchase order" description="Vendor and material eligibility are validated on the server. Totals are not taken from the browser." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <MasterPick entity="vendors" label="Vendor" required value={header.vendorId} onChange={(vendorId) => setHeader({ ...header, vendorId })} />
        <MasterPick entity="plants" label="Plant" required value={header.plantId} onChange={(plantId) => setHeader({ ...header, plantId })} />
        <MasterPick entity="warehouses" label="Warehouse" value={header.warehouseId} onChange={(warehouseId) => setHeader({ ...header, warehouseId })} />
        <Field label="PO date"><Input className="min-h-11" type="date" value={header.poDate} onChange={(event) => setHeader({ ...header, poDate: event.target.value })} /></Field>
        <Field label="Expected delivery"><Input className="min-h-11" type="date" value={header.expectedDeliveryDate} onChange={(event) => setHeader({ ...header, expectedDeliveryDate: event.target.value })} /></Field>
        <Field label="Over-receipt tolerance %"><Input className="min-h-11" type="number" value={header.overReceiptTolerancePercent} onChange={(event) => setHeader({ ...header, overReceiptTolerancePercent: event.target.value })} /></Field>
        <Field label="Quotation ID"><Input className="min-h-11" value={header.quotationId} onChange={(event) => setHeader({ ...header, quotationId: event.target.value })} /></Field>
        <Field label="Selection ID"><Input className="min-h-11" value={header.selectionId} onChange={(event) => setHeader({ ...header, selectionId: event.target.value })} /></Field>
        <Field label="PR ID"><Input className="min-h-11" value={header.requisitionId} onChange={(event) => setHeader({ ...header, requisitionId: event.target.value })} /></Field>
        <Field label="RFQ ID"><Input className="min-h-11" value={header.rfqId} onChange={(event) => setHeader({ ...header, rfqId: event.target.value })} /></Field>
      </div>
      <LineEditor
        items={items}
        onChange={setItems}
        render={(item, index, update) => (
          <>
            <MasterPick entity="materials" label="Material" required value={item.materialId} onChange={(materialId) => update(index, { materialId })} />
            <Field label="Qty"><Input className="min-h-11" type="number" value={item.orderedQuantity} onChange={(event) => update(index, { orderedQuantity: event.target.value })} /></Field>
            <MasterPick entity="uoms" label="UOM" required value={item.uom} onChange={(uom) => update(index, { uom })} />
            <Field label="Unit price"><Input className="min-h-11" type="number" value={item.unitPrice} onChange={(event) => update(index, { unitPrice: event.target.value })} /></Field>
          </>
        )}
      />
      <Button className="mt-4 min-h-11" onClick={() => void submit()}>Save draft PO</Button>
    </div>
  );
}

export function AmendmentForm() {
  return (
    <RequirePermission permission="purchaseOrderAmendment:create">
      <AmdInner />
    </RequirePermission>
  );
}

function AmdInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    purchaseOrderId: "",
    reason: "",
    expectedDeliveryDate: "",
    paymentTerms: "",
    remarks: "",
  });

  async function submit() {
    try {
      const result = await createProcurement("amendments", {
        ...header,
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("PO amendment submitted");
      router.push(`/procurement/amendments/${result.id}`);
    } catch (error) {
      toast.error("Unable to save amendment", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="PO amendment" description="Approved purchase orders are not overwritten. A new versioned amendment is created." />
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Purchase order ID">
          <Input className="min-h-11" value={header.purchaseOrderId} onChange={(event) => setHeader({ ...header, purchaseOrderId: event.target.value })} />
        </Field>
        <Field label="New expected delivery">
          <Input className="min-h-11" type="date" value={header.expectedDeliveryDate} onChange={(event) => setHeader({ ...header, expectedDeliveryDate: event.target.value })} />
        </Field>
        <Field label="Reason">
          <Input className="min-h-11" value={header.reason} onChange={(event) => setHeader({ ...header, reason: event.target.value })} />
        </Field>
        <Field label="Payment terms">
          <Input className="min-h-11" value={header.paymentTerms} onChange={(event) => setHeader({ ...header, paymentTerms: event.target.value })} />
        </Field>
      </div>
      <Button className="mt-4 min-h-11" onClick={() => void submit()}>Submit amendment</Button>
    </div>
  );
}

export function SelectionReasonField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label="Selection reason">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-h-11"><SelectValue placeholder="Required" /></SelectTrigger>
        <SelectContent>
          {selectionReasonOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function LineEditor<T>({
  items,
  onChange,
  render,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  render: (item: T, index: number, update: (index: number, patch: Partial<T>) => void) => ReactNode;
}) {
  function update(index: number, patch: Partial<T>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
          {render(item, index, update)}
        </div>
      ))}
      <Button variant="outline" className="min-h-11" onClick={() => onChange([...items, { ...items[0] }])}>
        Add line
      </Button>
    </div>
  );
}
