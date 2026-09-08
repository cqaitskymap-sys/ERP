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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createComplaintRecord, getComplaintBatch, getRelatedComplaints } from "@/lib/complaints/client";
import {
  communicationTypeOptions,
  defaultCategoryOptions,
  departmentOptions,
  recallClassOptions,
  severityOptions,
  sourceOptions,
  urgencyOptions,
} from "@/lib/complaints/catalog";
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
        <Button className="min-h-11" onClick={() => void onSubmit().catch((error) => toast.error("Unable to save", publicMasterError(error)))}>Save</Button>
      </div>
    </RequirePermission>
  );
}

export function ComplaintIntakeForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    sourceType: "customer",
    customerId: "",
    contactReference: "",
    country: "",
    marketId: "",
    productId: "",
    batchNumber: "",
    complaintDescription: "",
    urgency: "medium",
    initialAssessment: "",
    category: "",
    severity: "",
  });
  const [batchNote, setBatchNote] = useState("");
  const [related, setRelated] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!form.productId && !form.batchNumber && !form.customerId) return;
    const timer = window.setTimeout(() => {
      void getRelatedComplaints({ productId: form.productId, batchNumber: form.batchNumber, customerId: form.customerId, category: form.category })
        .then((result) => setRelated(result.rows))
        .catch(() => setRelated([]));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [form.productId, form.batchNumber, form.customerId, form.category]);

  return (
    <FormShell
      permission="complaintIntake:create"
      title="Complaint intake"
      description="Register a customer or market complaint. Complaint numbers are generated on the server and cannot be overwritten. Related records are suggestions only — they are not merged automatically."
      onSubmit={async () => {
        const result = await createComplaintRecord("cases", { ...form, idempotencyKey: crypto.randomUUID() });
        toast.success("Complaint registered");
        router.push(`/complaints/cases/${result.id}`);
      }}
    >
      <Field label="Source">
        <Select value={form.sourceType} onValueChange={(sourceType) => setForm({ ...form, sourceType })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{sourceOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Urgency">
        <Select value={form.urgency} onValueChange={(urgency) => setForm({ ...form, urgency })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{urgencyOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <MasterPick entity="customers" label="Customer" value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} />
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} required />
      <Field label="Batch">
        <Input className="min-h-11" value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} onBlur={() => {
          if (!form.batchNumber) return;
          void getComplaintBatch(form.batchNumber).then((result) => setBatchNote(result.found ? "Batch found in inventory." : "Batch Not Found — Investigation Required"));
        }} />
        {batchNote ? <p className="text-xs text-muted-foreground">{batchNote}</p> : null}
      </Field>
      <Field label="Country"><Input className="min-h-11" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></Field>
      <Field label="Market"><Input className="min-h-11" value={form.marketId} onChange={(event) => setForm({ ...form, marketId: event.target.value })} /></Field>
      <Field label="Contact reference"><Input className="min-h-11" value={form.contactReference} onChange={(event) => setForm({ ...form, contactReference: event.target.value })} /></Field>
      <Field label="Initial category">
        <Select value={form.category} onValueChange={(category) => setForm({ ...form, category })}>
          <SelectTrigger className="min-h-11"><SelectValue placeholder="Optional until QA classification" /></SelectTrigger>
          <SelectContent>{defaultCategoryOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Proposed severity">
        <Select value={form.severity} onValueChange={(severity) => setForm({ ...form, severity })}>
          <SelectTrigger className="min-h-11"><SelectValue placeholder="QA must confirm" /></SelectTrigger>
          <SelectContent>{severityOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <div className="md:col-span-2"><Field label="Complaint description"><Textarea value={form.complaintDescription} onChange={(event) => setForm({ ...form, complaintDescription: event.target.value })} /></Field></div>
      <div className="md:col-span-2"><Field label="Initial assessment"><Textarea value={form.initialAssessment} onChange={(event) => setForm({ ...form, initialAssessment: event.target.value })} /></Field></div>
      {related.length ? (
        <div className="md:col-span-2 rounded-xl border p-4">
          <p className="mb-2 text-sm font-medium">Potential related complaints</p>
          <p className="mb-3 text-xs text-muted-foreground">These are suggestions only. Authorized users decide whether records are related. Nothing is merged automatically.</p>
          <ul className="space-y-1 text-sm">{related.map((row) => <li key={String(row.id)}>{String(row.complaintNumber || row.id)} · {String(row.status || "")}</li>)}</ul>
        </div>
      ) : null}
    </FormShell>
  );
}

export function InvestigationForm() {
  const router = useRouter();
  const [form, setForm] = useState({ complaintId: "", investigationLead: "", department: "qa", objective: "", scope: "", dueDate: "" });
  return (
    <FormShell permission="complaintInvestigation:create" title="New investigation" description="Investigation numbers are generated on the server." onSubmit={async () => {
      const result = await createComplaintRecord("investigations", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Investigation opened");
      router.push(`/complaints/investigations/${result.id}`);
    }}>
      <Field label="Complaint ID"><Input className="min-h-11" value={form.complaintId} onChange={(event) => setForm({ ...form, complaintId: event.target.value })} /></Field>
      <Field label="Department">
        <Select value={form.department} onValueChange={(department) => setForm({ ...form, department })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{departmentOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Lead user ID"><Input className="min-h-11" value={form.investigationLead} onChange={(event) => setForm({ ...form, investigationLead: event.target.value })} /></Field>
      <Field label="Due date"><Input className="min-h-11" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Objective"><Textarea value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} /></Field></div>
      <div className="md:col-span-2"><Field label="Scope"><Textarea value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function SampleForm() {
  const router = useRouter();
  const [form, setForm] = useState({ complaintId: "", receivedFrom: "", quantity: "", condition: "", storageCondition: "", sampleLocation: "", testRequired: "" });
  return (
    <FormShell permission="complaintSample:create" title="Register complaint sample" description="Sample numbers are generated on the server. Chain of custody starts at receipt." onSubmit={async () => {
      const result = await createComplaintRecord("samples", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Sample logged");
      router.push(`/complaints/samples/${result.id}`);
    }}>
      <Field label="Complaint ID"><Input className="min-h-11" value={form.complaintId} onChange={(event) => setForm({ ...form, complaintId: event.target.value })} /></Field>
      <Field label="Received from"><Input className="min-h-11" value={form.receivedFrom} onChange={(event) => setForm({ ...form, receivedFrom: event.target.value })} /></Field>
      <Field label="Quantity"><Input className="min-h-11" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></Field>
      <Field label="Condition"><Input className="min-h-11" value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })} /></Field>
      <Field label="Storage condition"><Input className="min-h-11" value={form.storageCondition} onChange={(event) => setForm({ ...form, storageCondition: event.target.value })} /></Field>
      <Field label="Location"><Input className="min-h-11" value={form.sampleLocation} onChange={(event) => setForm({ ...form, sampleLocation: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Test required"><Textarea value={form.testRequired} onChange={(event) => setForm({ ...form, testRequired: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function CommunicationForm() {
  const router = useRouter();
  const [form, setForm] = useState({ complaintId: "", customerId: "", communicationType: "acknowledgement", subject: "", summary: "", response: "" });
  return (
    <FormShell permission="complaintCommunication:create" title="Customer communication draft" description="External communication requires authorized approval. Nothing is sent automatically." onSubmit={async () => {
      const result = await createComplaintRecord("communications", form);
      toast.success("Draft saved");
      router.push(`/complaints/communications/${result.id}`);
    }}>
      <Field label="Complaint ID"><Input className="min-h-11" value={form.complaintId} onChange={(event) => setForm({ ...form, complaintId: event.target.value })} /></Field>
      <MasterPick entity="customers" label="Customer" value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} />
      <Field label="Type">
        <Select value={form.communicationType} onValueChange={(communicationType) => setForm({ ...form, communicationType })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{communicationTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Subject"><Input className="min-h-11" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Summary"><Textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></Field></div>
      <div className="md:col-span-2"><Field label="Response draft"><Textarea value={form.response} onChange={(event) => setForm({ ...form, response: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function RecallForm() {
  const router = useRouter();
  const [form, setForm] = useState({ complaintId: "", productId: "", reason: "", riskAssessment: "", recallClass: "other", markets: "" });
  return (
    <FormShell permission="complaintRecall:create" title="Potential recall assessment" description="Opening this record does not decide that a recall is required. Authorized QA, management, and regulatory review is mandatory." onSubmit={async () => {
      const result = await createComplaintRecord("recalls", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Potential recall opened");
      router.push(`/complaints/recalls/${result.id}`);
    }}>
      <Field label="Complaint ID (optional)"><Input className="min-h-11" value={form.complaintId} onChange={(event) => setForm({ ...form, complaintId: event.target.value })} /></Field>
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} required />
      <Field label="Classification">
        <Select value={form.recallClass} onValueChange={(recallClass) => setForm({ ...form, recallClass })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{recallClassOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Markets"><Input className="min-h-11" value={form.markets} onChange={(event) => setForm({ ...form, markets: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Reason"><Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></Field></div>
      <div className="md:col-span-2"><Field label="Risk assessment notes"><Textarea value={form.riskAssessment} onChange={(event) => setForm({ ...form, riskAssessment: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function WithdrawalForm() {
  const router = useRouter();
  const [form, setForm] = useState({ complaintId: "", productId: "", reason: "", classification: "", markets: "" });
  return (
    <FormShell permission="complaintWithdrawal:create" title="Product withdrawal" description="Withdrawal is stored separately from recall and requires authorized approval." onSubmit={async () => {
      const result = await createComplaintRecord("withdrawals", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Withdrawal proposed");
      router.push(`/complaints/withdrawals/${result.id}`);
    }}>
      <Field label="Complaint ID"><Input className="min-h-11" value={form.complaintId} onChange={(event) => setForm({ ...form, complaintId: event.target.value })} /></Field>
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} required />
      <Field label="Classification"><Input className="min-h-11" value={form.classification} onChange={(event) => setForm({ ...form, classification: event.target.value })} /></Field>
      <Field label="Markets"><Input className="min-h-11" value={form.markets} onChange={(event) => setForm({ ...form, markets: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Reason"><Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function NotificationForm() {
  const router = useRouter();
  const [form, setForm] = useState({ complaintId: "", recallId: "", authorityId: "", marketId: "", subject: "", summary: "" });
  return (
    <FormShell permission="complaintRegulatory:create" title="Regulatory notification assessment" description="This prepares an assessment only. Nothing is submitted to an authority automatically." onSubmit={async () => {
      const result = await createComplaintRecord("notifications", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Assessment saved");
      router.push(`/complaints/notifications/${result.id}`);
    }}>
      <Field label="Complaint ID"><Input className="min-h-11" value={form.complaintId} onChange={(event) => setForm({ ...form, complaintId: event.target.value })} /></Field>
      <Field label="Recall ID"><Input className="min-h-11" value={form.recallId} onChange={(event) => setForm({ ...form, recallId: event.target.value })} /></Field>
      <Field label="Authority ID"><Input className="min-h-11" value={form.authorityId} onChange={(event) => setForm({ ...form, authorityId: event.target.value })} /></Field>
      <Field label="Market ID"><Input className="min-h-11" value={form.marketId} onChange={(event) => setForm({ ...form, marketId: event.target.value })} /></Field>
      <Field label="Subject"><Input className="min-h-11" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Summary"><Textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></Field></div>
    </FormShell>
  );
}

