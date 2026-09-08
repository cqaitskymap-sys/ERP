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
import { createPv, getPvBatch, getPvDuplicates, listPv } from "@/lib/pv/client";
import { DEFAULT_FOLLOWUP_QUESTIONS } from "@/lib/pv/config";
import {
  intakeSourceOptions,
  outcomeOptions,
  priorityOptions,
  reporterTypeOptions,
  severityOptions,
  urgencyOptions,
} from "@/lib/pv/catalog";
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

function PvPick({ resource, label, value, onChange, nameKey }: { resource: string; label: string; value: string; onChange: (value: string) => void; nameKey: string }) {
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id: string }>>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void listPv(resource, { pageSize: 80 }).then((result) => setRows(result.rows)).catch(() => setRows([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resource]);
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="min-h-11"><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>
          {rows.map((row) => (
            <SelectItem key={row.id} value={row.id}>{String(row[nameKey] || row.id)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function IntakeForm() {
  const router = useRouter();
  const [form, setForm] = useState({ sourceType: "other", sourceReference: "", country: "", productId: "", batchNumber: "", description: "", urgency: "medium" });
  const [batchNote, setBatchNote] = useState("");
  return (
    <FormShell permission="pvIntake:create" title="Safety case intake" description="Capture source information. The system does not decide medical validity." onSubmit={async () => {
      const result = await createPv("intakes", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Intake saved");
      router.push(`/pv/intake/${result.id}`);
    }}>
      <Field label="Source">
        <Select value={form.sourceType} onValueChange={(sourceType) => setForm({ ...form, sourceType })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{intakeSourceOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Urgency">
        <Select value={form.urgency} onValueChange={(urgency) => setForm({ ...form, urgency })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{urgencyOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} />
      <Field label="Batch">
        <Input className="min-h-11" value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} onBlur={() => {
          if (!form.batchNumber) return;
          void getPvBatch(form.batchNumber).then((result) => setBatchNote(result.found ? "Batch found in inventory." : "Batch not found"));
        }} />
        {batchNote ? <p className="text-xs text-muted-foreground">{batchNote}</p> : null}
      </Field>
      <Field label="Country"><Input className="min-h-11" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></Field>
      <Field label="Source reference"><Input className="min-h-11" value={form.sourceReference} onChange={(event) => setForm({ ...form, sourceReference: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function CaseForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    intakeId: "", productId: "", batchNumber: "", country: "", customerId: "", sourceType: "other", priority: "medium",
    description: "", eventTerm: "", onsetDate: "", outcome: "unknown", severity: "unknown",
    patientReference: "", age: "", ageUnit: "years", sex: "", reporterType: "other", organization: "",
  });
  const [duplicates, setDuplicates] = useState<Array<Record<string, unknown>>>([]);
  const [batchNote, setBatchNote] = useState("");

  useEffect(() => {
    if (!form.productId && !form.batchNumber) return;
    const timer = window.setTimeout(() => {
      void getPvDuplicates({ productId: form.productId, batchNumber: form.batchNumber, country: form.country, eventTerm: form.eventTerm })
        .then((result) => setDuplicates(result.rows))
        .catch(() => setDuplicates([]));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [form.productId, form.batchNumber, form.country, form.eventTerm]);

  return (
    <FormShell permission="pvCase:create" title="New safety case" description="Case numbers are generated on the server. Minimum information is checked; the software does not decide medical validity." onSubmit={async () => {
      const result = await createPv("cases", {
        ...form,
        idempotencyKey: crypto.randomUUID(),
        patient: { patientReference: form.patientReference, age: form.age, ageUnit: form.ageUnit, sex: form.sex, country: form.country },
        reporter: { reporterType: form.reporterType, organization: form.organization, country: form.country },
        products: form.productId ? [{ productId: form.productId, batchNumber: form.batchNumber, productRole: "suspect" }] : [],
        events: form.eventTerm ? [{ eventTerm: form.eventTerm, description: form.description, onsetDate: form.onsetDate, outcome: form.outcome, severity: form.severity }] : [],
      });
      toast.success("Safety case created");
      router.push(`/pv/cases/${result.id}`);
    }}>
      <PvPick resource="intakes" label="Intake (optional)" value={form.intakeId} onChange={(intakeId) => setForm({ ...form, intakeId })} nameKey="intakeNumber" />
      <Field label="Priority">
        <Select value={form.priority} onValueChange={(priority) => setForm({ ...form, priority })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{priorityOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <MasterPick entity="products" label="Suspect product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} required />
      <Field label="Batch">
        <Input className="min-h-11" value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} onBlur={() => {
          if (!form.batchNumber) return;
          void getPvBatch(form.batchNumber).then((result) => setBatchNote(result.found ? "Batch found." : "Batch not found"));
        }} />
        {batchNote ? <p className="text-xs text-muted-foreground">{batchNote}</p> : null}
      </Field>
      <MasterPick entity="customers" label="Customer" value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} />
      <Field label="Country"><Input className="min-h-11" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></Field>
      <Field label="Event term"><Input className="min-h-11" value={form.eventTerm} onChange={(event) => setForm({ ...form, eventTerm: event.target.value })} /></Field>
      <Field label="Onset date"><Input className="min-h-11" type="date" value={form.onsetDate} onChange={(event) => setForm({ ...form, onsetDate: event.target.value })} /></Field>
      <Field label="Outcome">
        <Select value={form.outcome} onValueChange={(outcome) => setForm({ ...form, outcome })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{outcomeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Severity (not seriousness)">
        <Select value={form.severity} onValueChange={(severity) => setForm({ ...form, severity })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{severityOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Patient reference (pseudonym)"><Input className="min-h-11" value={form.patientReference} onChange={(event) => setForm({ ...form, patientReference: event.target.value })} /></Field>
      <Field label="Age"><Input className="min-h-11" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} /></Field>
      <Field label="Reporter type">
        <Select value={form.reporterType} onValueChange={(reporterType) => setForm({ ...form, reporterType })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{reporterTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <div className="md:col-span-2"><Field label="Description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field></div>
      {duplicates.length ? (
        <div className="md:col-span-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">Potential duplicate cases</p>
          <p className="mb-2 text-muted-foreground">The system will not merge cases. An authorized user must confirm.</p>
          {duplicates.map((row) => <p key={String(row.id)}>{String(row.caseNumber)} · {String(row.eventTerm || "")} · {String(row.status)}</p>)}
        </div>
      ) : null}
    </FormShell>
  );
}

export function FollowUpForm() {
  const router = useRouter();
  const [form, setForm] = useState({ caseId: "", requestReason: "", dueDate: "", assignedTo: "", questions: DEFAULT_FOLLOWUP_QUESTIONS.slice(0, 3).join("\n") });
  return (
    <FormShell permission="pvFollowup:create" title="Request follow-up" description="Questions are configurable. These defaults can be edited." onSubmit={async () => {
      const result = await createPv("followups", { ...form, questions: form.questions.split("\n").map((item) => item.trim()).filter(Boolean) });
      toast.success("Follow-up requested");
      router.push(`/pv/follow-ups/${result.id}`);
    }}>
      <PvPick resource="cases" label="Case" value={form.caseId} onChange={(caseId) => setForm({ ...form, caseId })} nameKey="caseNumber" />
      <Field label="Due date"><Input className="min-h-11" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Reason"><Textarea value={form.requestReason} onChange={(event) => setForm({ ...form, requestReason: event.target.value })} /></Field></div>
      <div className="md:col-span-2"><Field label="Questions (one per line)"><Textarea value={form.questions} onChange={(event) => setForm({ ...form, questions: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function ReportForm() {
  const router = useRouter();
  const [form, setForm] = useState({ caseId: "", marketId: "", authorityId: "", reportType: "icsr", reportingRuleId: "", remarks: "" });
  return (
    <FormShell permission="pvRegulatoryReport:create" title="Regulatory report package" description="Configurable jurisdiction rules. The system does not submit to an authority automatically." onSubmit={async () => {
      const result = await createPv("reports", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Report package created");
      router.push(`/pv/regulatory-reports/${result.id}`);
    }}>
      <PvPick resource="cases" label="Case" value={form.caseId} onChange={(caseId) => setForm({ ...form, caseId })} nameKey="caseNumber" />
      <PvPick resource="rules" label="Reporting rule" value={form.reportingRuleId} onChange={(reportingRuleId) => setForm({ ...form, reportingRuleId })} nameKey="ruleNumber" />
      <Field label="Report type"><Input className="min-h-11" value={form.reportType} onChange={(event) => setForm({ ...form, reportType: event.target.value })} /></Field>
      <Field label="Remarks"><Textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} /></Field>
    </FormShell>
  );
}

export function RuleForm() {
  const router = useRouter();
  const [form, setForm] = useState({ marketId: "", authorityId: "", caseType: "serious", reportingWindow: "15", processingWindow: "30", sourceReference: "", timezone: "Asia/Kolkata" });
  return (
    <FormShell permission="pvRegulatoryReport:create" title="Reporting rule" description="Jurisdiction-specific windows. Do not treat defaults as a universal PV deadline." onSubmit={async () => {
      const result = await createPv("rules", { ...form, reportingWindow: Number(form.reportingWindow), processingWindow: Number(form.processingWindow) });
      toast.success("Rule saved");
      router.push(`/pv/rules/${result.id}`);
    }}>
      <Field label="Case type"><Input className="min-h-11" value={form.caseType} onChange={(event) => setForm({ ...form, caseType: event.target.value })} /></Field>
      <Field label="Reporting window (days)"><Input className="min-h-11" type="number" value={form.reportingWindow} onChange={(event) => setForm({ ...form, reportingWindow: event.target.value })} /></Field>
      <Field label="Processing window (days)"><Input className="min-h-11" type="number" value={form.processingWindow} onChange={(event) => setForm({ ...form, processingWindow: event.target.value })} /></Field>
      <Field label="Timezone"><Input className="min-h-11" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></Field>
      <Field label="Source reference"><Input className="min-h-11" value={form.sourceReference} onChange={(event) => setForm({ ...form, sourceReference: event.target.value })} /></Field>
    </FormShell>
  );
}

export function SignalForm() {
  const router = useRouter();
  const [form, setForm] = useState({ productId: "", eventTerm: "", description: "", evidence: "", detectionSource: "case_trend" });
  return (
    <FormShell permission="pvSignal:create" title="Potential safety signal" description="This is a potential signal until a qualified reviewer assesses it. The system does not confirm clinical significance." onSubmit={async () => {
      const result = await createPv("signals", form);
      toast.success("Potential signal recorded");
      router.push(`/pv/signals/${result.id}`);
    }}>
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} required />
      <Field label="Event term"><Input className="min-h-11" value={form.eventTerm} onChange={(event) => setForm({ ...form, eventTerm: event.target.value })} /></Field>
      <Field label="Detection source"><Input className="min-h-11" value={form.detectionSource} onChange={(event) => setForm({ ...form, detectionSource: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function CommitmentForm() {
  const router = useRouter();
  const [form, setForm] = useState({ source: "pv_case", sourceId: "", description: "", dueDate: "", priority: "medium" });
  return (
    <FormShell permission="pvCommitment:create" title="Safety commitment" description="Commitments reference source records. They do not duplicate CAPA." onSubmit={async () => {
      const result = await createPv("commitments", form);
      toast.success("Commitment created");
      router.push(`/pv/commitments/${result.id}`);
    }}>
      <Field label="Source"><Input className="min-h-11" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /></Field>
      <Field label="Source ID"><Input className="min-h-11" value={form.sourceId} onChange={(event) => setForm({ ...form, sourceId: event.target.value })} /></Field>
      <Field label="Due date"><Input className="min-h-11" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
      <Field label="Priority">
        <Select value={form.priority} onValueChange={(priority) => setForm({ ...form, priority })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{priorityOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <div className="md:col-span-2"><Field label="Description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export { Field };
