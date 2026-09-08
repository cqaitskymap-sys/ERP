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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSq } from "@/lib/supplier-quality/client";
import {
  agreementTypeOptions,
  auditTypeOptions,
  changeTypeOptions,
  documentTypeOptions,
  materialQualStatusOptions,
  qualificationTypeOptions,
  riskLevelOptions,
  suspensionReasonOptions,
} from "@/lib/supplier-quality/catalog";
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

export function ProfileForm() {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [remarks, setRemarks] = useState("");
  return (
    <FormShell permission="supplierQuality:update" title="Supplier quality profile" description="Extends the existing Vendor Master. A second supplier record is not created." onSubmit={async () => {
      const result = await createSq("profiles", { supplierId, remarks, idempotencyKey: crypto.randomUUID() });
      toast.success("Profile created");
      router.push(`/sq/profiles/${result.id}`);
    }}>
      <MasterPick entity="vendors" label="Vendor / supplier" value={supplierId} onChange={setSupplierId} required />
      <div className="md:col-span-2"><Field label="Remarks"><Textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} /></Field></div>
    </FormShell>
  );
}

export function QualificationForm() {
  const router = useRouter();
  const [form, setForm] = useState({ supplierId: "", qualificationType: "initial", riskLevel: "medium", owner: "", targetDate: "", remarks: "" });
  return (
    <FormShell permission="supplierQualityQualification:create" title="New qualification" description="Qualification numbers are generated on the server as SUP-Q-YYYY-#####." onSubmit={async () => {
      const result = await createSq("qualifications", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Qualification opened");
      router.push(`/sq/qualifications/${result.id}`);
    }}>
      <MasterPick entity="vendors" label="Vendor" value={form.supplierId} onChange={(supplierId) => setForm({ ...form, supplierId })} required />
      <Field label="Type"><Select value={form.qualificationType} onValueChange={(qualificationType) => setForm({ ...form, qualificationType })}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{qualificationTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Proposed risk"><Select value={form.riskLevel} onValueChange={(riskLevel) => setForm({ ...form, riskLevel })}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{riskLevelOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Target date"><Input className="min-h-11" type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Remarks"><Textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function EvaluationForm() {
  const router = useRouter();
  const [form, setForm] = useState({ supplierId: "", quality: "80", delivery: "80", documentation: "80", compliance: "80", service: "80", remarks: "" });
  return (
    <FormShell permission="supplierQualityEvaluation:create" title="Supplier evaluation" description="Weights are configurable. The recorded method and version are stored with the score." onSubmit={async () => {
      const result = await createSq("evaluations", form);
      toast.success("Evaluation saved");
      router.push(`/sq/evaluations/${result.id}`);
    }}>
      <MasterPick entity="vendors" label="Vendor" value={form.supplierId} onChange={(supplierId) => setForm({ ...form, supplierId })} required />
      {["quality", "delivery", "documentation", "compliance", "service"].map((key) => (
        <Field key={key} label={`${key} (0-100)`}><Input className="min-h-11" value={String(form[key as keyof typeof form])} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></Field>
      ))}
      <div className="md:col-span-2"><Field label="Remarks"><Textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function AuditForm() {
  const router = useRouter();
  const [form, setForm] = useState({ supplierId: "", auditType: "periodic", plannedDate: "", leadAuditor: "", scope: "", objective: "" });
  return (
    <FormShell permission="supplierQualityAudit:create" title="Plan supplier audit" description="Audit numbers are generated as SUP-AUD-YYYY-#####. Classification is recorded by the auditor, not the software." onSubmit={async () => {
      const result = await createSq("audits", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Audit planned");
      router.push(`/sq/audits/${result.id}`);
    }}>
      <MasterPick entity="vendors" label="Vendor" value={form.supplierId} onChange={(supplierId) => setForm({ ...form, supplierId })} required />
      <Field label="Type"><Select value={form.auditType} onValueChange={(auditType) => setForm({ ...form, auditType })}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{auditTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Planned date"><Input className="min-h-11" type="date" value={form.plannedDate} onChange={(event) => setForm({ ...form, plannedDate: event.target.value })} /></Field>
      <Field label="Lead auditor"><Input className="min-h-11" value={form.leadAuditor} onChange={(event) => setForm({ ...form, leadAuditor: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Scope"><Textarea value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} /></Field></div>
      <div className="md:col-span-2"><Field label="Objective"><Textarea value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function CertificateForm() {
  const router = useRouter();
  const [form, setForm] = useState({ supplierId: "", certificateType: "gmp_certificate", certificateNumber: "", issuingAuthority: "", issueDate: "", expiryDate: "" });
  return (
    <FormShell permission="supplierQualityCertificate:create" title="Supplier certificate" description="Expired certificates are not automatically approved." onSubmit={async () => {
      const result = await createSq("certificates", form);
      toast.success("Certificate recorded");
      router.push(`/sq/certificates/${result.id}`);
    }}>
      <MasterPick entity="vendors" label="Vendor" value={form.supplierId} onChange={(supplierId) => setForm({ ...form, supplierId })} required />
      <Field label="Type"><Select value={form.certificateType} onValueChange={(certificateType) => setForm({ ...form, certificateType })}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{documentTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Certificate number"><Input className="min-h-11" value={form.certificateNumber} onChange={(event) => setForm({ ...form, certificateNumber: event.target.value })} /></Field>
      <Field label="Issuing authority"><Input className="min-h-11" value={form.issuingAuthority} onChange={(event) => setForm({ ...form, issuingAuthority: event.target.value })} /></Field>
      <Field label="Issue date"><Input className="min-h-11" type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} /></Field>
      <Field label="Expiry date"><Input className="min-h-11" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} /></Field>
    </FormShell>
  );
}

export function AgreementForm() {
  const router = useRouter();
  const [form, setForm] = useState({ supplierId: "", agreementType: "quality", effectiveDate: "", expiryDate: "", version: "1", owner: "" });
  return (
    <FormShell permission="supplierQualityAgreement:create" title="Quality agreement" description="Supplier-quality agreement tracking only — not a full contract system." onSubmit={async () => {
      const result = await createSq("agreements", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Agreement saved");
      router.push(`/sq/agreements/${result.id}`);
    }}>
      <MasterPick entity="vendors" label="Vendor" value={form.supplierId} onChange={(supplierId) => setForm({ ...form, supplierId })} required />
      <Field label="Type"><Select value={form.agreementType} onValueChange={(agreementType) => setForm({ ...form, agreementType })}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{agreementTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Effective"><Input className="min-h-11" type="date" value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} /></Field>
      <Field label="Expiry"><Input className="min-h-11" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} /></Field>
    </FormShell>
  );
}

export function ChangeForm() {
  const router = useRouter();
  const [form, setForm] = useState({ supplierId: "", changeType: "other", description: "", impactAssessment: "" });
  return (
    <FormShell permission="supplierQualityChange:create" title="Supplier change notification" description="Formal change control is linked to the existing Phase 10 engine when required." onSubmit={async () => {
      const result = await createSq("changes", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Change logged");
      router.push(`/sq/changes/${result.id}`);
    }}>
      <MasterPick entity="vendors" label="Vendor" value={form.supplierId} onChange={(supplierId) => setForm({ ...form, supplierId })} required />
      <Field label="Type"><Select value={form.changeType} onValueChange={(changeType) => setForm({ ...form, changeType })}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{changeTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
      <div className="md:col-span-2"><Field label="Description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field></div>
      <div className="md:col-span-2"><Field label="Impact assessment"><Textarea value={form.impactAssessment} onChange={(event) => setForm({ ...form, impactAssessment: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function SuspensionForm() {
  const router = useRouter();
  const [form, setForm] = useState({ supplierId: "", reason: "other", remarks: "" });
  return (
    <FormShell permission="supplierQualitySuspension:create" title="Suspension proposal" description="Opening this record does not suspend the supplier. Authorized QA approval is required." onSubmit={async () => {
      const result = await createSq("suspensions", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Proposal saved");
      router.push(`/sq/suspended/${result.id}`);
    }}>
      <MasterPick entity="vendors" label="Vendor" value={form.supplierId} onChange={(supplierId) => setForm({ ...form, supplierId })} required />
      <Field label="Reason"><Select value={form.reason} onValueChange={(reason) => setForm({ ...form, reason })}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{suspensionReasonOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
      <div className="md:col-span-2"><Field label="Remarks"><Textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function RequalificationForm() {
  const router = useRouter();
  const [form, setForm] = useState({ supplierId: "", qualificationId: "", dueDate: "", riskLevel: "medium" });
  return (
    <FormShell permission="supplierQualityRequalification:create" title="Requalification" description="Periodic requalification. Approval is a qualified QA decision." onSubmit={async () => {
      const result = await createSq("requalifications", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Requalification opened");
      router.push(`/sq/requalifications/${result.id}`);
    }}>
      <MasterPick entity="vendors" label="Vendor" value={form.supplierId} onChange={(supplierId) => setForm({ ...form, supplierId })} required />
      <Field label="Prior qualification ID"><Input className="min-h-11" value={form.qualificationId} onChange={(event) => setForm({ ...form, qualificationId: event.target.value })} /></Field>
      <Field label="Due date"><Input className="min-h-11" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
    </FormShell>
  );
}

export function RiskForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    supplierId: "",
    materialCriticality: "5",
    productImpact: "5",
    regulatoryImpact: "5",
    supplierHistory: "5",
    geographicRisk: "5",
    manufacturingComplexity: "5",
    qualityPerformance: "5",
    auditHistory: "5",
    certificateStatus: "5",
    changeHistory: "5",
    rationale: "",
  });
  return (
    <FormShell permission="supplierQualityRisk:create" title="Supplier risk assessment" description="Configurable scoring. Authorized Quality personnel must approve the classification. The software does not decide qualification." onSubmit={async () => {
      const result = await createSq("risks", form);
      toast.success("Risk assessment recorded");
      router.push(`/sq/profiles`);
      void result;
    }}>
      <MasterPick entity="vendors" label="Vendor" value={form.supplierId} onChange={(supplierId) => setForm({ ...form, supplierId })} required />
      {(["materialCriticality", "productImpact", "regulatoryImpact", "supplierHistory", "geographicRisk", "manufacturingComplexity", "qualityPerformance", "auditHistory", "certificateStatus", "changeHistory"] as const).map((key) => (
        <Field key={key} label={`${key} (0-10)`}><Input className="min-h-11" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></Field>
      ))}
      <div className="md:col-span-2"><Field label="Rationale"><Textarea value={form.rationale} onChange={(event) => setForm({ ...form, rationale: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function QuestionnaireForm() {
  const router = useRouter();
  const [form, setForm] = useState({ supplierId: "", qualificationId: "", title: "Supplier quality questionnaire" });
  return (
    <FormShell permission="supplierQualityQuestionnaire:create" title="Supplier questionnaire" description="Internal workflow only. External supplier portal access is not enabled." onSubmit={async () => {
      const result = await createSq("questionnaires", form);
      toast.success("Questionnaire created");
      router.push(`/sq/qualifications`);
      void result;
    }}>
      <MasterPick entity="vendors" label="Vendor" value={form.supplierId} onChange={(supplierId) => setForm({ ...form, supplierId })} required />
      <Field label="Qualification ID"><Input className="min-h-11" value={form.qualificationId} onChange={(event) => setForm({ ...form, qualificationId: event.target.value })} /></Field>
      <Field label="Title"><Input className="min-h-11" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
    </FormShell>
  );
}

export function MaterialQualForm() {
  const router = useRouter();
  const [form, setForm] = useState({ supplierId: "", materialId: "", qualificationStatus: "pending", expiryDate: "", restrictions: "", remarks: "" });
  return (
    <FormShell permission="supplierQualityQualification:update" title="Material-supplier qualification" description="A supplier may be approved only for specific materials. Material Master is not duplicated." onSubmit={async () => {
      const result = await createSq("materials", form);
      toast.success("Material qualification saved");
      router.push(`/sq/approved`);
      void result;
    }}>
      <MasterPick entity="vendors" label="Vendor" value={form.supplierId} onChange={(supplierId) => setForm({ ...form, supplierId })} required />
      <MasterPick entity="materials" label="Material" value={form.materialId} onChange={(materialId) => setForm({ ...form, materialId })} required />
      <Field label="Status"><Select value={form.qualificationStatus} onValueChange={(qualificationStatus) => setForm({ ...form, qualificationStatus })}><SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger><SelectContent>{materialQualStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Expiry"><Input className="min-h-11" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Restrictions"><Textarea value={form.restrictions} onChange={(event) => setForm({ ...form, restrictions: event.target.value })} /></Field></div>
    </FormShell>
  );
}
