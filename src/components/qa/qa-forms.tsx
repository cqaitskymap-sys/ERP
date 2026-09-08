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
import { createQa } from "@/lib/qa/client";
import { listProduction } from "@/lib/production/client";
import {
  capaSourceOptions,
  changeTypeOptions,
  deviationSourceOptions,
  qaDocumentTypeOptions,
  qaPriorityOptions,
  qaSeverityOptions,
} from "@/lib/qa/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
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

function OrderPick({ value, onChange }: { value: string; onChange: (id: string, row?: Record<string, unknown>) => void }) {
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listProduction("orders", { pageSize: 50 })
        .then((result) => setRows(result.rows))
        .catch(() => setRows([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <Field label="Manufacturing order">
      <Select
        value={value}
        onValueChange={(id) => onChange(id, rows.find((row) => row.id === id))}
      >
        <SelectTrigger className="min-h-11"><SelectValue placeholder="Select manufacturing order" /></SelectTrigger>
        <SelectContent>
          {rows.map((row) => (
            <SelectItem key={row.id} value={row.id}>
              {String(row.orderNumber || row.batchNumber || row.id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function BatchReviewForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    manufacturingOrderId: "",
    batchNumber: "",
    productId: "",
    customerId: "",
    plantId: "",
    priority: "normal",
    dueDate: "",
    remarks: "",
  });
  return (
    <FormShell
      permission="qaBatchReview:update"
      title="Open batch review"
      description="Create a QA review for a completed manufacturing batch. Reviews are also opened automatically after QC approval for QA."
      onSubmit={async () => {
        try {
          const result = await createQa("reviews", { ...form, idempotencyKey: crypto.randomUUID() });
          toast.success("QA review opened");
          router.push(`/qa/reviews/${result.id}`);
        } catch (error) {
          toast.error("Unable to open review", publicMasterError(error));
        }
      }}
    >
      <OrderPick
        value={form.manufacturingOrderId}
        onChange={(id, row) =>
          setForm({
            ...form,
            manufacturingOrderId: id,
            batchNumber: String(row?.batchNumber || form.batchNumber),
            productId: String(row?.productId || form.productId),
            customerId: String(row?.customerId || form.customerId),
            plantId: String(row?.plantId || form.plantId),
          })
        }
      />
      <Field label="Batch number">
        <Input className="min-h-11" value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} />
      </Field>
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} />
      <MasterPick entity="customers" label="Customer" value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} />
      <Field label="Priority">
        <Select value={form.priority} onValueChange={(priority) => setForm({ ...form, priority })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {qaPriorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="QA due date">
        <Input className="min-h-11" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
      </Field>
      <Field label="Remarks">
        <Textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function DeviationForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    source: "manufacturing",
    batchNumber: "",
    productId: "",
    manufacturingOrderId: "",
    processStep: "",
    description: "",
    category: "",
    severity: "major",
    immediateAction: "",
    investigation: "",
    rootCause: "",
    impactAssessment: "",
    capaRequired: false,
  });
  return (
    <FormShell
      permission="qaDeviation:create"
      title="New deviation"
      description="Record a quality deviation. Critical deviations block batch release until resolved or formally dispositioned."
      onSubmit={async () => {
        try {
          const result = await createQa("deviations", form);
          toast.success("Deviation created");
          router.push(`/qa/deviations/${result.id}`);
        } catch (error) {
          toast.error("Unable to create deviation", publicMasterError(error));
        }
      }}
    >
      <Field label="Source">
        <Select value={form.source} onValueChange={(source) => setForm({ ...form, source })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {deviationSourceOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Severity">
        <Select value={form.severity} onValueChange={(severity) => setForm({ ...form, severity })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {qaSeverityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Batch number">
        <Input className="min-h-11" value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} />
      </Field>
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} />
      <Field label="Process step">
        <Input className="min-h-11" value={form.processStep} onChange={(event) => setForm({ ...form, processStep: event.target.value })} />
      </Field>
      <Field label="Category">
        <Input className="min-h-11" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Description">
          <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
      </div>
      <Field label="Immediate action">
        <Textarea value={form.immediateAction} onChange={(event) => setForm({ ...form, immediateAction: event.target.value })} />
      </Field>
      <Field label="Investigation">
        <Textarea value={form.investigation} onChange={(event) => setForm({ ...form, investigation: event.target.value })} />
      </Field>
      <Field label="Root cause">
        <Textarea value={form.rootCause} onChange={(event) => setForm({ ...form, rootCause: event.target.value })} />
      </Field>
      <Field label="Impact assessment">
        <Textarea value={form.impactAssessment} onChange={(event) => setForm({ ...form, impactAssessment: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function CapaForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    sourceType: "deviation",
    sourceId: "",
    description: "",
    problemStatement: "",
    rootCause: "",
    correction: "",
    correctiveAction: "",
    preventiveAction: "",
    ownerId: "",
    dueDate: "",
    priority: "normal",
  });
  return (
    <FormShell
      permission="qaCapa:create"
      title="New CAPA"
      description="Create a corrective and preventive action linked to a source record. Statistical root-cause analysis is not part of this phase."
      onSubmit={async () => {
        try {
          const result = await createQa("capas", form);
          toast.success("CAPA created");
          router.push(`/qa/capa/${result.id}`);
        } catch (error) {
          toast.error("Unable to create CAPA", publicMasterError(error));
        }
      }}
    >
      <Field label="Source type">
        <Select value={form.sourceType} onValueChange={(sourceType) => setForm({ ...form, sourceType })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {capaSourceOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Source record ID">
        <Input className="min-h-11" value={form.sourceId} onChange={(event) => setForm({ ...form, sourceId: event.target.value })} />
      </Field>
      <Field label="Priority">
        <Select value={form.priority} onValueChange={(priority) => setForm({ ...form, priority })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {qaPriorityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Due date">
        <Input className="min-h-11" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Description">
          <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
      </div>
      <Field label="Problem statement">
        <Textarea value={form.problemStatement} onChange={(event) => setForm({ ...form, problemStatement: event.target.value })} />
      </Field>
      <Field label="Root cause">
        <Textarea value={form.rootCause} onChange={(event) => setForm({ ...form, rootCause: event.target.value })} />
      </Field>
      <Field label="Correction">
        <Textarea value={form.correction} onChange={(event) => setForm({ ...form, correction: event.target.value })} />
      </Field>
      <Field label="Corrective action">
        <Textarea value={form.correctiveAction} onChange={(event) => setForm({ ...form, correctiveAction: event.target.value })} />
      </Field>
      <Field label="Preventive action">
        <Textarea value={form.preventiveAction} onChange={(event) => setForm({ ...form, preventiveAction: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function ChangeControlForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    reason: "",
    changeType: "minor",
    impactAssessment: "",
    riskAssessment: "",
    affectedModules: "",
    affectedProducts: "",
    affectedDocuments: "",
    implementationPlan: "",
    validationRequired: false,
    trainingRequired: false,
    ownerId: "",
    dueDate: "",
  });
  return (
    <FormShell
      permission="qaChangeControl:create"
      title="New change control"
      description="Implementation is blocked until the required QA approval is recorded."
      onSubmit={async () => {
        try {
          const result = await createQa("changes", form);
          toast.success("Change control created");
          router.push(`/qa/change-control/${result.id}`);
        } catch (error) {
          toast.error("Unable to create change control", publicMasterError(error));
        }
      }}
    >
      <Field label="Title">
        <Input className="min-h-11" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
      </Field>
      <Field label="Type">
        <Select value={form.changeType} onValueChange={(changeType) => setForm({ ...form, changeType })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {changeTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Description">
          <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </Field>
      </div>
      <Field label="Reason">
        <Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
      </Field>
      <Field label="Impact assessment">
        <Textarea value={form.impactAssessment} onChange={(event) => setForm({ ...form, impactAssessment: event.target.value })} />
      </Field>
      <Field label="Risk assessment">
        <Textarea value={form.riskAssessment} onChange={(event) => setForm({ ...form, riskAssessment: event.target.value })} />
      </Field>
      <Field label="Affected modules">
        <Input className="min-h-11" value={form.affectedModules} onChange={(event) => setForm({ ...form, affectedModules: event.target.value })} />
      </Field>
      <Field label="Affected products">
        <Input className="min-h-11" value={form.affectedProducts} onChange={(event) => setForm({ ...form, affectedProducts: event.target.value })} />
      </Field>
      <Field label="Implementation plan">
        <Textarea value={form.implementationPlan} onChange={(event) => setForm({ ...form, implementationPlan: event.target.value })} />
      </Field>
      <Field label="Due date">
        <Input className="min-h-11" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function DocumentReviewForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    documentType: "sop",
    title: "",
    documentNumber: "",
    version: "1",
    ownerId: "",
    departmentId: "",
    effectiveDate: "",
    reviewDate: "",
    expiryDate: "",
    sourceRecordId: "",
    remarks: "",
  });
  return (
    <FormShell
      permission="qaDocumentReview:read"
      title="New document review"
      description="Approved versions are never overwritten. Activate a new version to supersede the previous effective document."
      onSubmit={async () => {
        try {
          const result = await createQa("documents", form);
          toast.success("Document review created");
          router.push(`/qa/documents/${result.id}`);
        } catch (error) {
          toast.error("Unable to create document review", publicMasterError(error));
        }
      }}
    >
      <Field label="Document type">
        <Select value={form.documentType} onValueChange={(documentType) => setForm({ ...form, documentType })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {qaDocumentTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Title">
        <Input className="min-h-11" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
      </Field>
      <Field label="Document number">
        <Input className="min-h-11" value={form.documentNumber} onChange={(event) => setForm({ ...form, documentNumber: event.target.value })} />
      </Field>
      <Field label="Version">
        <Input className="min-h-11" value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} />
      </Field>
      <Field label="Effective date">
        <Input className="min-h-11" type="date" value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} />
      </Field>
      <Field label="Review date">
        <Input className="min-h-11" type="date" value={form.reviewDate} onChange={(event) => setForm({ ...form, reviewDate: event.target.value })} />
      </Field>
      <Field label="Expiry date">
        <Input className="min-h-11" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} />
      </Field>
      <Field label="Remarks">
        <Textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} />
      </Field>
    </FormShell>
  );
}
