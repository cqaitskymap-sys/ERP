"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createDms } from "@/lib/dms/client";
import {
  classificationOptions,
  dcrTypeOptions,
  documentTypeOptions,
} from "@/lib/dms/catalog";
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
  onSubmit,
  children,
  submitLabel = "Save",
}: {
  permission: Permission;
  title: string;
  description: string;
  onSubmit: () => Promise<void>;
  children: ReactNode;
  submitLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <RequirePermission permission={permission}>
      <div>
        <PageHeader title={title} description={description} />
        <form
          className="max-w-3xl space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void onSubmit()
              .catch((error) => toast.error("Unable to save", publicMasterError(error)))
              .finally(() => setBusy(false));
          }}
        >
          {children}
          <Button type="submit" className="min-h-11" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </Button>
        </form>
      </div>
    </RequirePermission>
  );
}

export function DocumentForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    documentType: "sop",
    category: "",
    departmentId: "",
    siteId: "",
    ownerId: "",
    reviewerId: "",
    approverId: "",
    confidentiality: "internal",
    relatedProducts: "",
    relatedProcesses: "",
    relatedEquipment: "",
    relatedMaterials: "",
    changeControlId: "",
    deviationId: "",
    capaId: "",
    reviewIntervalDays: "730",
    changeSummary: "Initial draft",
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <FormShell
      permission="dmsDocument:create"
      title="New controlled document"
      description="Creates a draft and version 1.0. The server assigns the document number. Upload does not make it effective."
      submitLabel="Create draft"
      onSubmit={async () => {
        const result = await createDms("documents", {
          ...form,
          reviewIntervalDays: Number(form.reviewIntervalDays || 730),
        });
        toast.success("Draft created");
        router.push(`/dms/documents/${result.id}`);
      }}
    >
      <Field label="Title">
        <Input className="min-h-11" value={form.title} onChange={(event) => set("title", event.target.value)} required />
      </Field>
      <Field label="Description">
        <Textarea value={form.description} onChange={(event) => set("description", event.target.value)} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Document type">
          <Select value={form.documentType} onValueChange={(value) => set("documentType", value)}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {documentTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Classification">
          <Select value={form.confidentiality} onValueChange={(value) => set("confidentiality", value)}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {classificationOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Category">
          <Input className="min-h-11" value={form.category} onChange={(event) => set("category", event.target.value)} />
        </Field>
        <Field label="Review interval (days)">
          <Input className="min-h-11" type="number" min={30} value={form.reviewIntervalDays} onChange={(event) => set("reviewIntervalDays", event.target.value)} />
        </Field>
        <Field label="Department ID">
          <Input className="min-h-11" value={form.departmentId} onChange={(event) => set("departmentId", event.target.value)} />
        </Field>
        <Field label="Site ID">
          <Input className="min-h-11" value={form.siteId} onChange={(event) => set("siteId", event.target.value)} />
        </Field>
        <Field label="Owner user ID">
          <Input className="min-h-11" value={form.ownerId} onChange={(event) => set("ownerId", event.target.value)} />
        </Field>
        <Field label="Reviewer user ID">
          <Input className="min-h-11" value={form.reviewerId} onChange={(event) => set("reviewerId", event.target.value)} />
        </Field>
        <Field label="Approver user ID">
          <Input className="min-h-11" value={form.approverId} onChange={(event) => set("approverId", event.target.value)} />
        </Field>
        <Field label="Change control ID">
          <Input className="min-h-11" value={form.changeControlId} onChange={(event) => set("changeControlId", event.target.value)} />
        </Field>
      </div>
      <Field label="Related products (comma separated)">
        <Input className="min-h-11" value={form.relatedProducts} onChange={(event) => set("relatedProducts", event.target.value)} />
      </Field>
      <Field label="Related processes">
        <Input className="min-h-11" value={form.relatedProcesses} onChange={(event) => set("relatedProcesses", event.target.value)} />
      </Field>
      <Field label="Related equipment">
        <Input className="min-h-11" value={form.relatedEquipment} onChange={(event) => set("relatedEquipment", event.target.value)} />
      </Field>
      <Field label="Related materials">
        <Input className="min-h-11" value={form.relatedMaterials} onChange={(event) => set("relatedMaterials", event.target.value)} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Deviation ID">
          <Input className="min-h-11" value={form.deviationId} onChange={(event) => set("deviationId", event.target.value)} />
        </Field>
        <Field label="CAPA ID">
          <Input className="min-h-11" value={form.capaId} onChange={(event) => set("capaId", event.target.value)} />
        </Field>
      </div>
      <Field label="Change summary">
        <Textarea value={form.changeSummary} onChange={(event) => set("changeSummary", event.target.value)} />
      </Field>
    </FormShell>
  );
}

export function ChangeRequestForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    requestType: "revision",
    title: "",
    reason: "",
    expectedImpact: "",
    documentId: "",
    gmpImpact: false,
    impactAssessment: "",
    changeControlId: "",
    affectedDepartments: "",
    affectedProducts: "",
    affectedProcesses: "",
    affectedEquipment: "",
    relatedDocuments: "",
    evidenceNote: "",
  });

  return (
    <FormShell
      permission="dmsChangeRequest:create"
      title="Document change request"
      description="Describe the change and its impact. GMP changes must be linked to an existing change control before approval."
      submitLabel="Create request"
      onSubmit={async () => {
        const result = await createDms("changeRequests", form);
        toast.success("Change request created");
        router.push(`/dms/change-requests/${result.id}`);
      }}
    >
      <Field label="Request type">
        <Select value={form.requestType} onValueChange={(value) => setForm({ ...form, requestType: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dcrTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Title">
        <Input className="min-h-11" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
      </Field>
      <Field label="Reason">
        <Textarea required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
      </Field>
      <Field label="Expected impact">
        <Textarea required value={form.expectedImpact} onChange={(event) => setForm({ ...form, expectedImpact: event.target.value })} />
      </Field>
      <Field label="Document ID">
        <Input className="min-h-11" value={form.documentId} onChange={(event) => setForm({ ...form, documentId: event.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.gmpImpact}
          onChange={(event) => setForm({ ...form, gmpImpact: event.target.checked })}
        />
        This change affects GMP operations
      </label>
      <Field label="Impact assessment">
        <Textarea value={form.impactAssessment} onChange={(event) => setForm({ ...form, impactAssessment: event.target.value })} />
      </Field>
      <Field label="Existing change control ID">
        <Input className="min-h-11" value={form.changeControlId} onChange={(event) => setForm({ ...form, changeControlId: event.target.value })} />
      </Field>
      <Field label="Affected departments">
        <Input className="min-h-11" value={form.affectedDepartments} onChange={(event) => setForm({ ...form, affectedDepartments: event.target.value })} />
      </Field>
      <Field label="Affected products">
        <Input className="min-h-11" value={form.affectedProducts} onChange={(event) => setForm({ ...form, affectedProducts: event.target.value })} />
      </Field>
      <Field label="Affected processes">
        <Input className="min-h-11" value={form.affectedProcesses} onChange={(event) => setForm({ ...form, affectedProcesses: event.target.value })} />
      </Field>
      <Field label="Affected equipment">
        <Input className="min-h-11" value={form.affectedEquipment} onChange={(event) => setForm({ ...form, affectedEquipment: event.target.value })} />
      </Field>
      <Field label="Related documents">
        <Input className="min-h-11" value={form.relatedDocuments} onChange={(event) => setForm({ ...form, relatedDocuments: event.target.value })} />
      </Field>
      <Field label="Evidence note">
        <Textarea value={form.evidenceNote} onChange={(event) => setForm({ ...form, evidenceNote: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function ExternalDocumentForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    documentType: "certificate",
    issuer: "",
    referenceNumber: "",
    departmentId: "",
    siteId: "",
    ownerId: "",
    expiryDate: "",
    reminderDays: "30",
    confidentiality: "internal",
    notes: "",
  });
  return (
    <FormShell
      permission="dmsExternal:create"
      title="Register external document"
      description="Track certificates and external documents. Expiry reminders use the configured lead time."
      submitLabel="Register"
      onSubmit={async () => {
        const result = await createDms("externalDocuments", { ...form, reminderDays: Number(form.reminderDays || 30) });
        toast.success("External document registered");
        router.push(`/dms/external/${result.id}`);
      }}
    >
      <Field label="Title">
        <Input className="min-h-11" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
      </Field>
      <Field label="Type">
        <Select value={form.documentType} onValueChange={(value) => setForm({ ...form, documentType: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vendor">Vendor</SelectItem>
            <SelectItem value="certificate">Certificate</SelectItem>
            <SelectItem value="regulatory_external">Regulatory external</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Issuer">
        <Input className="min-h-11" required value={form.issuer} onChange={(event) => setForm({ ...form, issuer: event.target.value })} />
      </Field>
      <Field label="Reference number">
        <Input className="min-h-11" value={form.referenceNumber} onChange={(event) => setForm({ ...form, referenceNumber: event.target.value })} />
      </Field>
      <Field label="Expiry date">
        <Input className="min-h-11" type="date" required value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} />
      </Field>
      <Field label="Reminder days">
        <Input className="min-h-11" type="number" min={1} value={form.reminderDays} onChange={(event) => setForm({ ...form, reminderDays: event.target.value })} />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      </Field>
    </FormShell>
  );
}

export function TemplateForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    documentType: "sop",
    label: "SOP",
    prefix: "SOP",
    category: "",
    reviewIntervalDays: "730",
    defaultConfidentiality: "internal",
    trainingRequired: true,
    gmpDefault: true,
    requiredApprovals: "1",
    requireReview: true,
    status: "active",
  });
  return (
    <FormShell
      permission="dmsNumbering:update"
      title="Numbering template"
      description="The prefix is used by the existing document numbering series. Duplicate numbers are rejected."
      submitLabel="Save template"
      onSubmit={async () => {
        await createDms("templates", {
          ...form,
          prefix: form.prefix.toUpperCase(),
          reviewIntervalDays: Number(form.reviewIntervalDays),
          requiredApprovals: Number(form.requiredApprovals),
        });
        toast.success("Template saved");
        router.push("/dms/templates");
      }}
    >
      <Field label="Document type">
        <Select value={form.documentType} onValueChange={(value) => setForm({ ...form, documentType: value })}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {documentTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Label">
        <Input className="min-h-11" required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} />
      </Field>
      <Field label="Prefix">
        <Input className="min-h-11" required value={form.prefix} onChange={(event) => setForm({ ...form, prefix: event.target.value.toUpperCase() })} />
      </Field>
      <Field label="Review interval days">
        <Input className="min-h-11" type="number" min={30} value={form.reviewIntervalDays} onChange={(event) => setForm({ ...form, reviewIntervalDays: event.target.value })} />
      </Field>
      <Field label="Required approvals">
        <Input className="min-h-11" type="number" min={1} max={5} value={form.requiredApprovals} onChange={(event) => setForm({ ...form, requiredApprovals: event.target.value })} />
      </Field>
    </FormShell>
  );
}
