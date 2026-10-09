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
import { createSales } from "@/lib/sales/client";
import { orderTypeOptions, requirementCategoryOptions } from "@/lib/sales/catalog";
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

const emptyLine = {
  productId: "",
  productCode: "",
  packSize: "",
  uom: "",
  quantity: "",
  unitPrice: "",
  discount: "0",
  tax: "0",
  freight: "0",
  otherCharges: "0",
  notes: "",
};

function LineEditor({
  items,
  setItems,
}: {
  items: Array<typeof emptyLine>;
  setItems: (items: Array<typeof emptyLine>) => void;
}) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
          <MasterPick
            entity="products"
            label={`Product ${index + 1}`}
            required
            value={item.productId}
            onChange={(productId) => {
              const next = [...items];
              next[index] = { ...item, productId };
              setItems(next);
            }}
          />
          <Field label="Pack size">
            <Input className="min-h-11" value={item.packSize} onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, packSize: e.target.value };
              setItems(next);
            }} />
          </Field>
          <Field label="UOM">
            <Input className="min-h-11" value={item.uom} onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, uom: e.target.value };
              setItems(next);
            }} />
          </Field>
          <Field label="Quantity">
            <Input className="min-h-11" type="number" value={item.quantity} onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, quantity: e.target.value };
              setItems(next);
            }} />
          </Field>
          <Field label="Unit price">
            <Input className="min-h-11" type="number" value={item.unitPrice} onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, unitPrice: e.target.value };
              setItems(next);
            }} />
          </Field>
          <Field label="Discount">
            <Input className="min-h-11" type="number" value={item.discount} onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, discount: e.target.value };
              setItems(next);
            }} />
          </Field>
          <Field label="Tax">
            <Input className="min-h-11" type="number" value={item.tax} onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, tax: e.target.value };
              setItems(next);
            }} />
          </Field>
          <Field label="Freight">
            <Input className="min-h-11" type="number" value={item.freight} onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, freight: e.target.value };
              setItems(next);
            }} />
          </Field>
          <Field label="Other charges">
            <Input className="min-h-11" type="number" value={item.otherCharges} onChange={(e) => {
              const next = [...items];
              next[index] = { ...item, otherCharges: e.target.value };
              setItems(next);
            }} />
          </Field>
        </div>
      ))}
      <Button type="button" variant="outline" className="min-h-11" onClick={() => setItems([...items, emptyLine])}>
        Add line
      </Button>
    </div>
  );
}

function mapLines(items: Array<typeof emptyLine>) {
  return items.map((item) => ({
    ...item,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    discount: Number(item.discount || 0),
    tax: Number(item.tax || 0),
    freight: Number(item.freight || 0),
    otherCharges: Number(item.otherCharges || 0),
  }));
}

export function QuotationForm() {
  return (
    <RequirePermission permission="salesQuotation:create">
      <QuotationInner />
    </RequirePermission>
  );
}

function QuotationInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    customerId: "",
    quotationDate: new Date().toISOString().slice(0, 10),
    validUntil: "",
    currency: "INR",
    paymentTerms: "",
    deliveryTerms: "",
    expectedDeliveryDate: "",
    customerRequirements: "",
    customerNotes: "",
    internalNotes: "",
  });
  const [items, setItems] = useState([emptyLine]);

  async function submit() {
    try {
      const result = await createSales("quotations", {
        ...header,
        idempotencyKey: crypto.randomUUID(),
        items: mapLines(items),
      });
      toast.success("Draft quotation created");
      router.push(`/sales/quotations/${result.id}`);
    } catch (error) {
      toast.error("Unable to save quotation", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New quotation" description="Server-issued QT-YYYY-##### number. Status starts as Draft." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <MasterPick entity="customers" label="Customer" required value={header.customerId} onChange={(customerId) => setHeader({ ...header, customerId })} />
        <Field label="Quotation date">
          <Input className="min-h-11" type="date" value={header.quotationDate} onChange={(e) => setHeader({ ...header, quotationDate: e.target.value })} />
        </Field>
        <Field label="Valid until">
          <Input className="min-h-11" type="date" value={header.validUntil} onChange={(e) => setHeader({ ...header, validUntil: e.target.value })} />
        </Field>
        <Field label="Currency">
          <Input className="min-h-11" value={header.currency} onChange={(e) => setHeader({ ...header, currency: e.target.value })} />
        </Field>
        <Field label="Payment terms">
          <Input className="min-h-11" value={header.paymentTerms} onChange={(e) => setHeader({ ...header, paymentTerms: e.target.value })} />
        </Field>
        <Field label="Delivery terms">
          <Input className="min-h-11" value={header.deliveryTerms} onChange={(e) => setHeader({ ...header, deliveryTerms: e.target.value })} />
        </Field>
        <Field label="Expected delivery">
          <Input className="min-h-11" type="date" value={header.expectedDeliveryDate} onChange={(e) => setHeader({ ...header, expectedDeliveryDate: e.target.value })} />
        </Field>
        <Field label="Customer requirements">
          <Textarea value={header.customerRequirements} onChange={(e) => setHeader({ ...header, customerRequirements: e.target.value })} />
        </Field>
      </div>
      <LineEditor items={items} setItems={setItems} />
      <div className="mt-6">
        <Button className="min-h-11" onClick={() => void submit()}>Save draft quotation</Button>
      </div>
    </div>
  );
}

export function SalesOrderForm() {
  return (
    <RequirePermission permission="salesOrder:create">
      <OrderInner />
    </RequirePermission>
  );
}

function OrderInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    customerId: "",
    orderType: "standard",
    orderDate: new Date().toISOString().slice(0, 10),
    customerPoNumber: "",
    quotationId: "",
    currency: "INR",
    paymentTerms: "",
    deliveryAddress: "",
    requestedDeliveryDate: "",
    promisedDeliveryDate: "",
    regulatoryMarket: "",
    warehouseId: "",
    creditOverrideReason: "",
    customerNotes: "",
    internalNotes: "",
  });
  const [items, setItems] = useState([emptyLine]);

  async function submit() {
    try {
      const result = await createSales("orders", {
        ...header,
        idempotencyKey: crypto.randomUUID(),
        items: mapLines(items),
      });
      toast.success("Draft sales order created");
      router.push(`/sales/orders/${result.id}`);
    } catch (error) {
      toast.error("Unable to save sales order", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New sales order" description="Server-issued SO-YYYY-##### number with controlled status transitions." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <MasterPick entity="customers" label="Customer" required value={header.customerId} onChange={(customerId) => setHeader({ ...header, customerId })} />
        <Field label="Order type">
          <Select value={header.orderType} onValueChange={(orderType) => setHeader({ ...header, orderType })}>
            <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {orderTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Order date">
          <Input className="min-h-11" type="date" value={header.orderDate} onChange={(e) => setHeader({ ...header, orderDate: e.target.value })} />
        </Field>
        <Field label="Customer PO">
          <Input className="min-h-11" value={header.customerPoNumber} onChange={(e) => setHeader({ ...header, customerPoNumber: e.target.value })} />
        </Field>
        <Field label="Quotation ID">
          <Input className="min-h-11" value={header.quotationId} onChange={(e) => setHeader({ ...header, quotationId: e.target.value })} />
        </Field>
        <MasterPick entity="warehouses" label="Warehouse" value={header.warehouseId} onChange={(warehouseId) => setHeader({ ...header, warehouseId })} />
        <Field label="Requested delivery">
          <Input className="min-h-11" type="date" value={header.requestedDeliveryDate} onChange={(e) => setHeader({ ...header, requestedDeliveryDate: e.target.value })} />
        </Field>
        <Field label="Promised delivery">
          <Input className="min-h-11" type="date" value={header.promisedDeliveryDate} onChange={(e) => setHeader({ ...header, promisedDeliveryDate: e.target.value })} />
        </Field>
        <Field label="Delivery address">
          <Textarea value={header.deliveryAddress} onChange={(e) => setHeader({ ...header, deliveryAddress: e.target.value })} />
        </Field>
        <Field label="Credit override reason">
          <Textarea value={header.creditOverrideReason} onChange={(e) => setHeader({ ...header, creditOverrideReason: e.target.value })} />
        </Field>
      </div>
      <LineEditor items={items} setItems={setItems} />
      <div className="mt-6">
        <Button className="min-h-11" onClick={() => void submit()}>Save draft sales order</Button>
      </div>
    </div>
  );
}

export function PriceListForm() {
  return (
    <RequirePermission permission="salesPricing:create">
      <PriceListInner />
    </RequirePermission>
  );
}

function PriceListInner() {
  const router = useRouter();
  const [header, setHeader] = useState({
    customerId: "",
    name: "",
    currency: "INR",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: "",
    contractReference: "",
    remarks: "",
  });
  const [rules, setRules] = useState([{ productId: "", unitPrice: "", minQuantity: "1", discountPercent: "0", taxPercent: "0", packSize: "" }]);

  async function submit() {
    try {
      const result = await createSales("priceLists", {
        ...header,
        idempotencyKey: crypto.randomUUID(),
        rules: rules.map((rule) => ({
          ...rule,
          unitPrice: Number(rule.unitPrice),
          minQuantity: Number(rule.minQuantity || 0),
          discountPercent: Number(rule.discountPercent || 0),
          taxPercent: Number(rule.taxPercent || 0),
        })),
      });
      toast.success("Draft price list created");
      router.push(`/sales/pricing/${result.id}`);
    } catch (error) {
      toast.error("Unable to save price list", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New price list" description="Customer or general pricing with effective dates. Activation requires approval permission." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <MasterPick entity="customers" label="Customer (optional)" value={header.customerId} onChange={(customerId) => setHeader({ ...header, customerId })} />
        <Field label="Name">
          <Input className="min-h-11" value={header.name} onChange={(e) => setHeader({ ...header, name: e.target.value })} />
        </Field>
        <Field label="Effective from">
          <Input className="min-h-11" type="date" value={header.effectiveFrom} onChange={(e) => setHeader({ ...header, effectiveFrom: e.target.value })} />
        </Field>
        <Field label="Effective to">
          <Input className="min-h-11" type="date" value={header.effectiveTo} onChange={(e) => setHeader({ ...header, effectiveTo: e.target.value })} />
        </Field>
      </div>
      {rules.map((rule, index) => (
        <div key={index} className="mb-3 grid gap-3 rounded-xl border p-4 md:grid-cols-3">
          <MasterPick entity="products" label="Product" required value={rule.productId} onChange={(productId) => {
            const next = [...rules];
            next[index] = { ...rule, productId };
            setRules(next);
          }} />
          <Field label="Unit price">
            <Input className="min-h-11" type="number" value={rule.unitPrice} onChange={(e) => {
              const next = [...rules];
              next[index] = { ...rule, unitPrice: e.target.value };
              setRules(next);
            }} />
          </Field>
          <Field label="Min quantity">
            <Input className="min-h-11" type="number" value={rule.minQuantity} onChange={(e) => {
              const next = [...rules];
              next[index] = { ...rule, minQuantity: e.target.value };
              setRules(next);
            }} />
          </Field>
        </div>
      ))}
      <Button type="button" variant="outline" className="mr-2 min-h-11" onClick={() => setRules([...rules, { productId: "", unitPrice: "", minQuantity: "1", discountPercent: "0", taxPercent: "0", packSize: "" }])}>
        Add rule
      </Button>
      <Button className="min-h-11" onClick={() => void submit()}>Save draft price list</Button>
    </div>
  );
}

export function RequirementForm() {
  return (
    <RequirePermission permission="salesRequirement:create">
      <RequirementInner />
    </RequirePermission>
  );
}

function RequirementInner() {
  const router = useRouter();
  const [form, setForm] = useState({
    customerId: "",
    productId: "",
    category: "coa",
    title: "",
    description: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    affectsManufacturing: false,
    affectsQuality: false,
    affectsRegulatory: false,
  });

  async function submit() {
    try {
      const result = await createSales("requirements", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Customer requirement created");
      router.push(`/sales/requirements/${result.id}`);
    } catch (error) {
      toast.error("Unable to save requirement", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New customer requirement" description="Controlled requirements are not applied to approved specifications automatically." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <MasterPick entity="customers" label="Customer" required value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} />
        <MasterPick entity="products" label="Product (optional)" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} />
        <Field label="Category">
          <Select value={form.category} onValueChange={(category) => setForm({ ...form, category })}>
            <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {requirementCategoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Effective from">
          <Input className="min-h-11" type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
        </Field>
        <Field label="Title">
          <Input className="min-h-11" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
      </div>
      <Button className="min-h-11" onClick={() => void submit()}>Save requirement</Button>
    </div>
  );
}

export function CmoForm() {
  return (
    <RequirePermission permission="contractManufacturing:create">
      <CmoInner />
    </RequirePermission>
  );
}

function CmoInner() {
  const router = useRouter();
  const [form, setForm] = useState({
    customerId: "",
    productId: "",
    customerBrand: "",
    customerProductReference: "",
    customerPoNumber: "",
    manufacturingQuantity: "",
    bomId: "",
    regulatoryMarket: "",
    expectedDeliveryDate: "",
    qualityAgreementId: "",
    remarks: "",
  });

  async function submit() {
    try {
      const result = await createSales("contractOrders", {
        ...form,
        manufacturingQuantity: Number(form.manufacturingQuantity),
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("Contract manufacturing order created");
      router.push(`/sales/cmo/${result.id}`);
    } catch (error) {
      toast.error("Unable to save CMO", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New contract manufacturing order" description="Commercial CMO record. Production is not authorized until technical/QA/regulatory approvals complete." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <MasterPick entity="customers" label="Customer" required value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} />
        <MasterPick entity="products" label="Product" required value={form.productId} onChange={(productId) => setForm({ ...form, productId })} />
        <Field label="Customer brand">
          <Input className="min-h-11" value={form.customerBrand} onChange={(e) => setForm({ ...form, customerBrand: e.target.value })} />
        </Field>
        <Field label="Customer product reference">
          <Input className="min-h-11" value={form.customerProductReference} onChange={(e) => setForm({ ...form, customerProductReference: e.target.value })} />
        </Field>
        <Field label="Manufacturing quantity">
          <Input className="min-h-11" type="number" value={form.manufacturingQuantity} onChange={(e) => setForm({ ...form, manufacturingQuantity: e.target.value })} />
        </Field>
        <Field label="Approved BOM ID">
          <Input className="min-h-11" value={form.bomId} onChange={(e) => setForm({ ...form, bomId: e.target.value })} />
        </Field>
        <Field label="Regulatory market">
          <Input className="min-h-11" value={form.regulatoryMarket} onChange={(e) => setForm({ ...form, regulatoryMarket: e.target.value })} />
        </Field>
        <Field label="Expected delivery">
          <Input className="min-h-11" type="date" value={form.expectedDeliveryDate} onChange={(e) => setForm({ ...form, expectedDeliveryDate: e.target.value })} />
        </Field>
      </div>
      <Button className="min-h-11" onClick={() => void submit()}>Save CMO draft</Button>
    </div>
  );
}

export function ReturnForm() {
  return (
    <RequirePermission permission="salesReturn:create">
      <ReturnInner />
    </RequirePermission>
  );
}

function ReturnInner() {
  const router = useRouter();
  const [form, setForm] = useState({
    salesOrderId: "",
    customerId: "",
    productId: "",
    batchNumber: "",
    quantity: "",
    reason: "",
  });

  async function submit() {
    try {
      const result = await createSales("returns", {
        ...form,
        quantity: Number(form.quantity),
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("Sales return requested");
      router.push(`/sales/returns/${result.id}`);
    } catch (error) {
      toast.error("Unable to save return", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader title="New sales return" description="Returned goods remain quarantined until authorized QA disposition. Stock is never auto-restocked." />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Field label="Sales order ID">
          <Input className="min-h-11" value={form.salesOrderId} onChange={(e) => setForm({ ...form, salesOrderId: e.target.value })} />
        </Field>
        <MasterPick entity="customers" label="Customer" required value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} />
        <MasterPick entity="products" label="Product" required value={form.productId} onChange={(productId) => setForm({ ...form, productId })} />
        <Field label="Batch number">
          <Input className="min-h-11" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
        </Field>
        <Field label="Quantity">
          <Input className="min-h-11" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </Field>
        <Field label="Reason">
          <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </Field>
      </div>
      <Button className="min-h-11" onClick={() => void submit()}>Submit return request</Button>
    </div>
  );
}

export function CreditSnapshotForm() {
  return (
    <RequirePermission permission="salesCredit:create">
      <CreditInner />
    </RequirePermission>
  );
}

function CreditInner() {
  const router = useRouter();
  const [form, setForm] = useState({
    customerId: "",
    creditLimit: "",
    outstandingBalance: "",
    overdueBalance: "",
    currency: "INR",
    asOfDate: new Date().toISOString().slice(0, 10),
    invoiceReferences: "",
    remarks: "",
  });

  async function submit() {
    try {
      await createSales("receivables", {
        ...form,
        creditLimit: Number(form.creditLimit || 0),
        outstandingBalance: Number(form.outstandingBalance || 0),
        overdueBalance: Number(form.overdueBalance || 0),
        source: "manual_reference",
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("Receivable snapshot saved");
      router.push("/sales/credit");
    } catch (error) {
      toast.error("Unable to save snapshot", publicMasterError(error));
    }
  }

  return (
    <div>
      <PageHeader
        title="Receivable snapshot"
        description="Scoped credit reference only. Not a full accounting ledger. Payment is not claimed unless confirmed by Finance."
      />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <MasterPick entity="customers" label="Customer" required value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} />
        <Field label="As of date">
          <Input className="min-h-11" type="date" value={form.asOfDate} onChange={(e) => setForm({ ...form, asOfDate: e.target.value })} />
        </Field>
        <Field label="Credit limit">
          <Input className="min-h-11" type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
        </Field>
        <Field label="Outstanding balance">
          <Input className="min-h-11" type="number" value={form.outstandingBalance} onChange={(e) => setForm({ ...form, outstandingBalance: e.target.value })} />
        </Field>
        <Field label="Overdue balance">
          <Input className="min-h-11" type="number" value={form.overdueBalance} onChange={(e) => setForm({ ...form, overdueBalance: e.target.value })} />
        </Field>
        <Field label="Invoice references">
          <Input className="min-h-11" value={form.invoiceReferences} onChange={(e) => setForm({ ...form, invoiceReferences: e.target.value })} />
        </Field>
      </div>
      <Button className="min-h-11" onClick={() => void submit()}>Save snapshot</Button>
    </div>
  );
}
