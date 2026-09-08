"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { createQc, listQc } from "@/lib/qc/client";
import {
  dispositionOptions,
  qcPriorityOptions,
  sampleSourceOptions,
  stabilityTimepointOptions,
  testTypeOptions,
} from "@/lib/qc/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import { useAuth } from "@/hooks/use-auth";
import type { Permission } from "@/types/permissions";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function FormShell({
  permission,
  title,
  description,
  children,
  onSubmit,
}: {
  permission: Permission;
  title: string;
  description: string;
  children: ReactNode;
  onSubmit: () => Promise<void>;
}) {
  return (
    <RequirePermission permission={permission}>
      <div>
        <PageHeader title={title} description={description} />
        <div className="mb-6 grid gap-3 md:grid-cols-2">{children}</div>
        <Button className="min-h-11" onClick={() => void onSubmit()}>
          Save
        </Button>
      </div>
    </RequirePermission>
  );
}

function QcPick({
  resource,
  label,
  value,
  onChange,
  nameKey,
}: {
  resource: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  nameKey: string;
}) {
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listQc(resource, { pageSize: 100 })
        .then((result) => setRows(result.rows))
        .catch(() => setRows([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resource]);
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-h-11"><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>
          {rows.map((row) => (
            <SelectItem key={row.id} value={row.id}>
              {String(row[nameKey] || row.id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function AnalystPick({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Array<{ uid: string; name?: string; email?: string }>>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/users")
        .then((response) => response.json())
        .then((body) => setRows(Array.isArray(body.users) ? body.users : []))
        .catch(() => setRows([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const options = rows.length
    ? rows
    : user
      ? [{ uid: user.uid, name: user.displayName || undefined, email: user.email || undefined }]
      : [];
  return (
    <Field label="Analyst">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-h-11"><SelectValue placeholder="Select analyst" /></SelectTrigger>
        <SelectContent>
          {options.map((row) => (
            <SelectItem key={row.uid} value={row.uid}>
              {row.name || row.email || row.uid}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function SampleRequestForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    sourceType: "raw_material_receipt",
    sourceRecordId: "",
    plantId: "",
    warehouseId: "",
    productId: "",
    materialId: "",
    batchNumber: "",
    vendorId: "",
    goodsReceiptId: "",
    manufacturingOrderId: "",
    customerId: "",
    priority: "normal",
    requiredDate: "",
    remarks: "",
  });
  return (
    <FormShell
      permission="qcSample:create"
      title="New sample request"
      description="Request a laboratory sample from a receipt, batch, or manufacturing order. Sample numbers are generated on the server."
      onSubmit={async () => {
        try {
          const result = await createQc("sampleRequests", { ...form, idempotencyKey: crypto.randomUUID() });
          toast.success("Sample request created");
          router.push(`/qc/sample-requests/${result.id}`);
        } catch (error) {
          toast.error("Unable to create sample request", publicMasterError(error));
        }
      }}
    >
      <Field label="Source type">
        <Select value={form.sourceType} onValueChange={(sourceType) => setForm({ ...form, sourceType })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {sampleSourceOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Source record ID">
        <Input className="min-h-11" value={form.sourceRecordId} onChange={(event) => setForm({ ...form, sourceRecordId: event.target.value })} />
      </Field>
      <MasterPick entity="plants" label="Plant" value={form.plantId} onChange={(plantId) => setForm({ ...form, plantId })} />
      <MasterPick entity="warehouses" label="Warehouse" value={form.warehouseId} onChange={(warehouseId) => setForm({ ...form, warehouseId })} />
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} />
      <MasterPick entity="materials" label="Material" value={form.materialId} onChange={(materialId) => setForm({ ...form, materialId })} />
      <MasterPick entity="vendors" label="Vendor" value={form.vendorId} onChange={(vendorId) => setForm({ ...form, vendorId })} />
      <MasterPick entity="customers" label="Customer" value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} />
      <Field label="Batch number">
        <Input className="min-h-11" value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} />
      </Field>
      <Field label="Goods receipt ID">
        <Input className="min-h-11" value={form.goodsReceiptId} onChange={(event) => setForm({ ...form, goodsReceiptId: event.target.value })} />
      </Field>
      <Field label="Manufacturing order ID">
        <Input className="min-h-11" value={form.manufacturingOrderId} onChange={(event) => setForm({ ...form, manufacturingOrderId: event.target.value })} />
      </Field>
      <Field label="Priority">
        <Select value={form.priority} onValueChange={(priority) => setForm({ ...form, priority })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {qcPriorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Required date">
        <Input className="min-h-11" type="date" value={form.requiredDate} onChange={(event) => setForm({ ...form, requiredDate: event.target.value })} />
      </Field>
      <Field label="Remarks">
        <Textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function SampleForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    sampleRequestId: "",
    sampleType: "routine",
    sourceType: "raw_material_receipt",
    sourceRecordId: "",
    productId: "",
    materialId: "",
    batchNumber: "",
    vendorId: "",
    goodsReceiptId: "",
    manufacturingOrderId: "",
    quantity: "1",
    uom: "G",
    containerCount: "1",
    samplingLocation: "",
    storageCondition: "",
    remarks: "",
  });
  return (
    <FormShell
      permission="qcSample:create"
      title="Register sample"
      description="Create a controlled sample. The sample number is generated server-side and cannot be edited."
      onSubmit={async () => {
        try {
          const result = await createQc("samples", {
            ...form,
            quantity: Number(form.quantity),
            containerCount: Number(form.containerCount),
            idempotencyKey: crypto.randomUUID(),
          });
          toast.success("Sample registered");
          router.push(`/qc/samples/${result.id}`);
        } catch (error) {
          toast.error("Unable to register sample", publicMasterError(error));
        }
      }}
    >
      <QcPick resource="sampleRequests" label="Sample request" value={form.sampleRequestId} onChange={(sampleRequestId) => setForm({ ...form, sampleRequestId })} nameKey="sampleRequestNumber" />
      <Field label="Source type">
        <Select value={form.sourceType} onValueChange={(sourceType) => setForm({ ...form, sourceType })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {sampleSourceOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} />
      <MasterPick entity="materials" label="Material" value={form.materialId} onChange={(materialId) => setForm({ ...form, materialId })} />
      <Field label="Batch number">
        <Input className="min-h-11" value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} />
      </Field>
      <MasterPick entity="vendors" label="Vendor" value={form.vendorId} onChange={(vendorId) => setForm({ ...form, vendorId })} />
      <Field label="Quantity">
        <Input className="min-h-11" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
      </Field>
      <MasterPick entity="uoms" label="UOM" required value={form.uom} onChange={(uom) => setForm({ ...form, uom })} />
      <Field label="Containers">
        <Input className="min-h-11" type="number" value={form.containerCount} onChange={(event) => setForm({ ...form, containerCount: event.target.value })} />
      </Field>
      <Field label="Sampling location">
        <Input className="min-h-11" value={form.samplingLocation} onChange={(event) => setForm({ ...form, samplingLocation: event.target.value })} />
      </Field>
      <Field label="Storage condition">
        <Input className="min-h-11" value={form.storageCondition} onChange={(event) => setForm({ ...form, storageCondition: event.target.value })} />
      </Field>
      <Field label="Remarks">
        <Textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function TestRequestForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    sampleId: "",
    specificationId: "",
    productId: "",
    materialId: "",
    batchNumber: "",
    priority: "normal",
    dueDate: "",
    remarks: "",
  });
  return (
    <FormShell
      permission="qcTest:create"
      title="New test request"
      description="Create a test request against an effective specification. Calculation and evaluation happen on the server."
      onSubmit={async () => {
        try {
          const result = await createQc("testRequests", { ...form, idempotencyKey: crypto.randomUUID() });
          toast.success("Test request created");
          router.push(`/qc/test-requests/${result.id}`);
        } catch (error) {
          toast.error("Unable to create test request", publicMasterError(error));
        }
      }}
    >
      <QcPick resource="samples" label="Sample" value={form.sampleId} onChange={(sampleId) => setForm({ ...form, sampleId })} nameKey="sampleNumber" />
      <QcPick resource="specifications" label="Specification" value={form.specificationId} onChange={(specificationId) => setForm({ ...form, specificationId })} nameKey="specificationNumber" />
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} />
      <MasterPick entity="materials" label="Material" value={form.materialId} onChange={(materialId) => setForm({ ...form, materialId })} />
      <Field label="Batch number">
        <Input className="min-h-11" value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} />
      </Field>
      <Field label="Priority">
        <Select value={form.priority} onValueChange={(priority) => setForm({ ...form, priority })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {qcPriorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Due date">
        <Input className="min-h-11" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
      </Field>
      <Field label="Remarks">
        <Textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function AssignmentForm() {
  const router = useRouter();
  const [form, setForm] = useState({ testRequestId: "", testId: "", analystId: "", dueDate: "", priority: "normal" });
  return (
    <FormShell
      permission="qcTest:assign"
      title="Assign test"
      description="Assign a laboratory test to a qualified analyst. Expired instruments and standards are blocked at execution."
      onSubmit={async () => {
        try {
          const result = await createQc("assignments", form);
          toast.success("Test assigned");
          router.push(`/qc/test-requests/${form.testRequestId || result.id}`);
        } catch (error) {
          toast.error("Unable to assign test", publicMasterError(error));
        }
      }}
    >
      <QcPick resource="testRequests" label="Test request" value={form.testRequestId} onChange={(testRequestId) => setForm({ ...form, testRequestId })} nameKey="testRequestNumber" />
      <QcPick resource="tests" label="Test" value={form.testId} onChange={(testId) => setForm({ ...form, testId })} nameKey="testNumber" />
      <AnalystPick value={form.analystId} onChange={(analystId) => setForm({ ...form, analystId })} />
      <Field label="Due date">
        <Input className="min-h-11" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
      </Field>
      <Field label="Priority">
        <Select value={form.priority} onValueChange={(priority) => setForm({ ...form, priority })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {qcPriorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </FormShell>
  );
}

export function SpecificationForm() {
  const router = useRouter();
  const [form, setForm] = useState({ productId: "", materialId: "", effectiveDate: new Date().toISOString().slice(0, 10), expiryDate: "", remarks: "" });
  const [items, setItems] = useState([{ parameterName: "", testType: "numeric", unit: "", target: "", minimum: "", maximum: "", acceptanceCriteria: "", sequence: "1", mandatory: true, testMethodId: "", calculation: "" }]);
  return (
    <RequirePermission permission="qcSpecification:create">
      <div>
        <PageHeader title="New specification" description="Version-controlled acceptance criteria. Approved specifications are never overwritten." />
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} />
          <MasterPick entity="materials" label="Material" value={form.materialId} onChange={(materialId) => setForm({ ...form, materialId })} />
          <Field label="Effective date">
            <Input className="min-h-11" type="date" value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} />
          </Field>
          <Field label="Expiry date">
            <Input className="min-h-11" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} />
          </Field>
          <Field label="Remarks">
            <Textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} />
          </Field>
        </div>
        <div className="mb-4 space-y-3">
          {items.map((item, index) => (
            <div key={index} className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
              <Field label="Parameter">
                <Input className="min-h-11" value={item.parameterName} onChange={(event) => setItems(items.map((row, i) => i === index ? { ...row, parameterName: event.target.value } : row))} />
              </Field>
              <Field label="Test type">
                <Select value={item.testType} onValueChange={(testType) => setItems(items.map((row, i) => i === index ? { ...row, testType } : row))}>
                  <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {testTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Unit">
                <Input className="min-h-11" value={item.unit} onChange={(event) => setItems(items.map((row, i) => i === index ? { ...row, unit: event.target.value } : row))} />
              </Field>
              <Field label="Minimum">
                <Input className="min-h-11" value={item.minimum} onChange={(event) => setItems(items.map((row, i) => i === index ? { ...row, minimum: event.target.value } : row))} />
              </Field>
              <Field label="Maximum">
                <Input className="min-h-11" value={item.maximum} onChange={(event) => setItems(items.map((row, i) => i === index ? { ...row, maximum: event.target.value } : row))} />
              </Field>
              <Field label="Acceptance criteria">
                <Input className="min-h-11" value={item.acceptanceCriteria} onChange={(event) => setItems(items.map((row, i) => i === index ? { ...row, acceptanceCriteria: event.target.value } : row))} />
              </Field>
            </div>
          ))}
          <Button variant="outline" className="min-h-11" onClick={() => setItems([...items, { parameterName: "", testType: "numeric", unit: "", target: "", minimum: "", maximum: "", acceptanceCriteria: "", sequence: String(items.length + 1), mandatory: true, testMethodId: "", calculation: "" }])}>
            Add parameter
          </Button>
        </div>
        <Button
          className="min-h-11"
          onClick={() => {
            void createQc("specifications", { ...form, items: items.map((item, index) => ({ ...item, sequence: index + 1 })), idempotencyKey: crypto.randomUUID() })
              .then((result) => {
                toast.success("Specification draft created");
                router.push(`/qc/specifications/${result.id}`);
              })
              .catch((error) => toast.error("Unable to save specification", publicMasterError(error)));
          }}
        >
          Save draft
        </Button>
      </div>
    </RequirePermission>
  );
}

export function TestMethodForm() {
  const router = useRouter();
  const [form, setForm] = useState({ methodName: "", effectiveDate: new Date().toISOString().slice(0, 10), expiryDate: "", description: "", referenceStandard: "", remarks: "" });
  return (
    <FormShell
      permission="qcTestMethod:create"
      title="New test method"
      description="Controlled laboratory method. Historical results keep the method version used."
      onSubmit={async () => {
        try {
          const result = await createQc("methods", { ...form, idempotencyKey: crypto.randomUUID() });
          toast.success("Test method created");
          router.push(`/qc/methods/${result.id}`);
        } catch (error) {
          toast.error("Unable to save method", publicMasterError(error));
        }
      }}
    >
      <Field label="Method name">
        <Input className="min-h-11" value={form.methodName} onChange={(event) => setForm({ ...form, methodName: event.target.value })} />
      </Field>
      <Field label="Effective date">
        <Input className="min-h-11" type="date" value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} />
      </Field>
      <Field label="Expiry date">
        <Input className="min-h-11" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} />
      </Field>
      <Field label="Reference standard">
        <Input className="min-h-11" value={form.referenceStandard} onChange={(event) => setForm({ ...form, referenceStandard: event.target.value })} />
      </Field>
      <Field label="Description">
        <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function OosForm() {
  const router = useRouter();
  const [form, setForm] = useState({ testRequestId: "", sampleId: "", batchNumber: "", parameter: "", observedResult: "", specification: "", severity: "major", description: "" });
  return (
    <FormShell
      permission="qcOos:create"
      title="New OOS record"
      description="Out-of-specification foundation. Investigation and CAPA belong to a future QA phase. This record is not closed automatically."
      onSubmit={async () => {
        try {
          const result = await createQc("oos", form);
          toast.success("OOS opened");
          router.push(`/qc/oos/${result.id}`);
        } catch (error) {
          toast.error("Unable to create OOS", publicMasterError(error));
        }
      }}
    >
      <QcPick resource="testRequests" label="Test request" value={form.testRequestId} onChange={(testRequestId) => setForm({ ...form, testRequestId })} nameKey="testRequestNumber" />
      <QcPick resource="samples" label="Sample" value={form.sampleId} onChange={(sampleId) => setForm({ ...form, sampleId })} nameKey="sampleNumber" />
      <Field label="Batch number">
        <Input className="min-h-11" value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} />
      </Field>
      <Field label="Parameter">
        <Input className="min-h-11" value={form.parameter} onChange={(event) => setForm({ ...form, parameter: event.target.value })} />
      </Field>
      <Field label="Observed result">
        <Input className="min-h-11" value={form.observedResult} onChange={(event) => setForm({ ...form, observedResult: event.target.value })} />
      </Field>
      <Field label="Specification">
        <Input className="min-h-11" value={form.specification} onChange={(event) => setForm({ ...form, specification: event.target.value })} />
      </Field>
      <Field label="Severity">
        <Select value={form.severity} onValueChange={(severity) => setForm({ ...form, severity })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="minor">Minor</SelectItem>
            <SelectItem value="major">Major</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Description">
        <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function OotForm() {
  const router = useRouter();
  const [form, setForm] = useState({ sampleId: "", batchNumber: "", parameter: "", currentResult: "", historicalTrend: "", remarks: "" });
  return (
    <FormShell
      permission="qcOot:create"
      title="New OOT record"
      description="Out-of-trend is a controlled user action. Unusual values are not classified automatically."
      onSubmit={async () => {
        try {
          await createQc("oot", form);
          toast.success("OOT opened");
          router.push(`/qc/oot`);
        } catch (error) {
          toast.error("Unable to create OOT", publicMasterError(error));
        }
      }}
    >
      <QcPick resource="samples" label="Sample" value={form.sampleId} onChange={(sampleId) => setForm({ ...form, sampleId })} nameKey="sampleNumber" />
      <Field label="Batch number">
        <Input className="min-h-11" value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} />
      </Field>
      <Field label="Parameter">
        <Input className="min-h-11" value={form.parameter} onChange={(event) => setForm({ ...form, parameter: event.target.value })} />
      </Field>
      <Field label="Current result">
        <Input className="min-h-11" value={form.currentResult} onChange={(event) => setForm({ ...form, currentResult: event.target.value })} />
      </Field>
      <Field label="Historical trend">
        <Textarea value={form.historicalTrend} onChange={(event) => setForm({ ...form, historicalTrend: event.target.value })} />
      </Field>
      <Field label="Remarks">
        <Textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function RetestForm() {
  const router = useRouter();
  const [form, setForm] = useState({ originalTestId: "", reason: "", analystId: "" });
  return (
    <FormShell
      permission="qcRetest:create"
      title="Request retest"
      description="Creates a new test linked to the original. The original result is never overwritten. Retest count is limited."
      onSubmit={async () => {
        try {
          const result = await createQc("retests", form);
          toast.success("Retest created");
          router.push(`/qc/tests/${String((result as { test?: { id?: string } }).test?.id || result.id)}`);
        } catch (error) {
          toast.error("Unable to create retest", publicMasterError(error));
        }
      }}
    >
      <QcPick resource="tests" label="Original test" value={form.originalTestId} onChange={(originalTestId) => setForm({ ...form, originalTestId })} nameKey="testNumber" />
      <AnalystPick value={form.analystId} onChange={(analystId) => setForm({ ...form, analystId })} />
      <Field label="Reason">
        <Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function CoaForm() {
  const router = useRouter();
  const [testRequestId, setTestRequestId] = useState("");
  return (
    <FormShell
      permission="qcCoa:create"
      title="Generate COA"
      description="Certificate of Analysis can be generated only after QC review and approval. Approved COAs cannot be edited."
      onSubmit={async () => {
        try {
          const result = await createQc("coas", { testRequestId, idempotencyKey: crypto.randomUUID() });
          toast.success("COA generated");
          router.push(`/qc/coa/${result.id}`);
        } catch (error) {
          toast.error("Unable to generate COA", publicMasterError(error));
        }
      }}
    >
      <QcPick resource="testRequests" label="Test request" value={testRequestId} onChange={setTestRequestId} nameKey="testRequestNumber" />
    </FormShell>
  );
}

export function DispositionForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    testRequestId: "",
    sampleId: "",
    manufacturingOrderId: "",
    inventoryBatchId: "",
    batchNumber: "",
    productId: "",
    materialId: "",
    disposition: "pending",
    remarks: "",
    reason: "",
  });
  return (
    <FormShell
      permission="qcTest:approve"
      title="QC disposition"
      description="QC may recommend a disposition for QA. Inventory is not moved to Approved from this screen."
      onSubmit={async () => {
        try {
          await createQc("dispositions", form);
          toast.success("QC disposition recorded");
          router.push("/qc");
        } catch (error) {
          toast.error("Unable to record disposition", publicMasterError(error));
        }
      }}
    >
      <QcPick resource="testRequests" label="Test request" value={form.testRequestId} onChange={(testRequestId) => setForm({ ...form, testRequestId })} nameKey="testRequestNumber" />
      <QcPick resource="samples" label="Sample" value={form.sampleId} onChange={(sampleId) => setForm({ ...form, sampleId })} nameKey="sampleNumber" />
      <Field label="Manufacturing order ID">
        <Input className="min-h-11" value={form.manufacturingOrderId} onChange={(event) => setForm({ ...form, manufacturingOrderId: event.target.value })} />
      </Field>
      <Field label="Inventory batch ID">
        <Input className="min-h-11" value={form.inventoryBatchId} onChange={(event) => setForm({ ...form, inventoryBatchId: event.target.value })} />
      </Field>
      <Field label="Batch number">
        <Input className="min-h-11" value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} />
      </Field>
      <Field label="Disposition">
        <Select value={form.disposition} onValueChange={(disposition) => setForm({ ...form, disposition })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {dispositionOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Reason">
        <Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function InstrumentForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    instrumentCode: "",
    instrumentName: "",
    instrumentType: "",
    manufacturer: "",
    model: "",
    serialNumber: "",
    location: "",
    calibrationStatus: "current",
    calibrationDueDate: "",
    qualificationStatus: "qualified",
    status: "active",
  });
  return (
    <FormShell
      permission="qcInstrument:create"
      title="New laboratory instrument"
      description="Expired or overdue calibration instruments cannot be used on controlled tests."
      onSubmit={async () => {
        try {
          const result = await createQc("instruments", form);
          toast.success("Instrument saved");
          router.push(`/qc/instruments/${result.id}`);
        } catch (error) {
          toast.error("Unable to save instrument", publicMasterError(error));
        }
      }}
    >
      <Field label="Code"><Input className="min-h-11" value={form.instrumentCode} onChange={(event) => setForm({ ...form, instrumentCode: event.target.value })} /></Field>
      <Field label="Name"><Input className="min-h-11" value={form.instrumentName} onChange={(event) => setForm({ ...form, instrumentName: event.target.value })} /></Field>
      <Field label="Type"><Input className="min-h-11" value={form.instrumentType} onChange={(event) => setForm({ ...form, instrumentType: event.target.value })} /></Field>
      <Field label="Manufacturer"><Input className="min-h-11" value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} /></Field>
      <Field label="Model"><Input className="min-h-11" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></Field>
      <Field label="Serial number"><Input className="min-h-11" value={form.serialNumber} onChange={(event) => setForm({ ...form, serialNumber: event.target.value })} /></Field>
      <Field label="Location"><Input className="min-h-11" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field>
      <Field label="Calibration due">
        <Input className="min-h-11" type="date" value={form.calibrationDueDate} onChange={(event) => setForm({ ...form, calibrationDueDate: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function StandardForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    standardCode: "",
    name: "",
    lotNumber: "",
    potency: "",
    expiryDate: "",
    storageCondition: "",
    quantity: "0",
    uom: "",
    status: "available",
  });
  return (
    <FormShell
      permission="qcReferenceStandard:create"
      title="New reference standard"
      description="Expired reference standards cannot be used for valid testing."
      onSubmit={async () => {
        try {
          const result = await createQc("standards", { ...form, quantity: Number(form.quantity) });
          toast.success("Reference standard saved");
          router.push(`/qc/standards/${result.id}`);
        } catch (error) {
          toast.error("Unable to save standard", publicMasterError(error));
        }
      }}
    >
      <Field label="Code"><Input className="min-h-11" value={form.standardCode} onChange={(event) => setForm({ ...form, standardCode: event.target.value })} /></Field>
      <Field label="Name"><Input className="min-h-11" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
      <Field label="Lot number"><Input className="min-h-11" value={form.lotNumber} onChange={(event) => setForm({ ...form, lotNumber: event.target.value })} /></Field>
      <Field label="Potency"><Input className="min-h-11" value={form.potency} onChange={(event) => setForm({ ...form, potency: event.target.value })} /></Field>
      <Field label="Expiry">
        <Input className="min-h-11" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} />
      </Field>
      <Field label="Storage condition"><Input className="min-h-11" value={form.storageCondition} onChange={(event) => setForm({ ...form, storageCondition: event.target.value })} /></Field>
      <Field label="Quantity"><Input className="min-h-11" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
      <MasterPick entity="uoms" label="UOM" value={form.uom} onChange={(uom) => setForm({ ...form, uom })} />
    </FormShell>
  );
}

export function StabilityForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    productId: "",
    batchNumber: "",
    condition: "25C/60% RH",
    protocol: "",
    startDate: new Date().toISOString().slice(0, 10),
    frequency: "protocol",
    timepoints: ["initial", "3_month", "6_month", "12_month"] as string[],
  });
  return (
    <FormShell
      permission="qcStability:create"
      title="New stability study"
      description="Stability study foundation only. Chamber IoT monitoring is not implemented in this phase."
      onSubmit={async () => {
        try {
          const result = await createQc("stability", form);
          toast.success("Stability study created");
          router.push(`/qc/stability/${result.id}`);
        } catch (error) {
          toast.error("Unable to create study", publicMasterError(error));
        }
      }}
    >
      <MasterPick entity="products" label="Product" required value={form.productId} onChange={(productId) => setForm({ ...form, productId })} />
      <Field label="Batch number">
        <Input className="min-h-11" value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} />
      </Field>
      <Field label="Condition">
        <Input className="min-h-11" value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })} />
      </Field>
      <Field label="Protocol">
        <Input className="min-h-11" value={form.protocol} onChange={(event) => setForm({ ...form, protocol: event.target.value })} />
      </Field>
      <Field label="Start date">
        <Input className="min-h-11" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
      </Field>
      <Field label="Timepoints">
        <p className="text-sm text-muted-foreground">
          {stabilityTimepointOptions.filter((option) => form.timepoints.includes(option.value)).map((option) => option.label).join(", ")}
        </p>
      </Field>
    </FormShell>
  );
}

