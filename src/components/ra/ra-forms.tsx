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
import { createRa, listRa } from "@/lib/ra/client";
import {
  commitmentSourceOptions,
  communicationDirectionOptions,
  communicationTypeOptions,
  documentTypeOptions,
  registrationTypeOptions,
} from "@/lib/ra/catalog";
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

function RaPick({
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
      void listRa(resource, { pageSize: 80 }).then((result) => setRows(result.rows)).catch(() => setRows([]));
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

export function ProfileForm() {
  const router = useRouter();
  const [form, setForm] = useState({ productId: "", dosageForm: "", strength: "", regulatoryCategory: "", manufacturingSite: "", remarks: "" });
  return (
    <FormShell permission="raProduct:update" title="Regulatory product profile" description="Links a regulatory profile to the existing product master. Products are not duplicated." onSubmit={async () => {
      const result = await createRa("profiles", { ...form, idempotencyKey: `ra-profile-${form.productId}` });
      toast.success("Regulatory profile saved");
      router.push(`/ra/products/${result.id}`);
    }}>
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} required />
      <Field label="Dosage form"><Input className="min-h-11" value={form.dosageForm} onChange={(event) => setForm({ ...form, dosageForm: event.target.value })} /></Field>
      <Field label="Strength"><Input className="min-h-11" value={form.strength} onChange={(event) => setForm({ ...form, strength: event.target.value })} /></Field>
      <Field label="Regulatory category"><Input className="min-h-11" value={form.regulatoryCategory} onChange={(event) => setForm({ ...form, regulatoryCategory: event.target.value })} /></Field>
      <Field label="Manufacturing site"><Input className="min-h-11" value={form.manufacturingSite} onChange={(event) => setForm({ ...form, manufacturingSite: event.target.value })} /></Field>
      <Field label="Remarks"><Textarea value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} /></Field>
    </FormShell>
  );
}

export function MarketForm() {
  const router = useRouter();
  const [form, setForm] = useState({ marketCode: "", marketName: "", country: "", region: "", currency: "", timezone: "" });
  return (
    <FormShell permission="raMarket:create" title="New market" description="Administrators configure markets. Countries are not hard-coded." onSubmit={async () => {
      const result = await createRa("markets", form);
      toast.success("Market created");
      router.push(`/ra/markets/${result.id}`);
    }}>
      <Field label="Market code"><Input className="min-h-11" value={form.marketCode} onChange={(event) => setForm({ ...form, marketCode: event.target.value })} /></Field>
      <Field label="Market name"><Input className="min-h-11" value={form.marketName} onChange={(event) => setForm({ ...form, marketName: event.target.value })} /></Field>
      <Field label="Country"><Input className="min-h-11" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></Field>
      <Field label="Region"><Input className="min-h-11" value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} /></Field>
      <Field label="Currency"><Input className="min-h-11" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} /></Field>
      <Field label="Timezone"><Input className="min-h-11" value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} /></Field>
    </FormShell>
  );
}

export function AuthorityForm() {
  const router = useRouter();
  const [form, setForm] = useState({ authorityName: "", country: "", region: "", websiteReference: "", contactDetails: "", submissionMethod: "", notes: "" });
  return (
    <FormShell permission="raAuthority:create" title="New regulatory authority" description="National, regional, and state authorities are configurable. One country may have many authorities." onSubmit={async () => {
      const result = await createRa("authorities", form);
      toast.success("Authority created");
      router.push(`/ra/authorities/${result.id}`);
    }}>
      <Field label="Authority name"><Input className="min-h-11" value={form.authorityName} onChange={(event) => setForm({ ...form, authorityName: event.target.value })} /></Field>
      <Field label="Country"><Input className="min-h-11" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} /></Field>
      <Field label="Region"><Input className="min-h-11" value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} /></Field>
      <Field label="Website"><Input className="min-h-11" value={form.websiteReference} onChange={(event) => setForm({ ...form, websiteReference: event.target.value })} /></Field>
      <Field label="Submission method"><Input className="min-h-11" value={form.submissionMethod} onChange={(event) => setForm({ ...form, submissionMethod: event.target.value })} /></Field>
      <Field label="Contact details"><Textarea value={form.contactDetails} onChange={(event) => setForm({ ...form, contactDetails: event.target.value })} /></Field>
    </FormShell>
  );
}

export function RegistrationForm() {
  const router = useRouter();
  const [form, setForm] = useState({ productId: "", marketId: "", authorityId: "", applicant: "", manufacturer: "", marketingAuthorizationHolder: "", expiryDate: "", registrationType: "new_registration", remarks: "" });
  return (
    <FormShell permission="raRegistration:create" title="New product registration" description="Registration numbers are generated on the server and cannot be overwritten." onSubmit={async () => {
      try {
        const result = await createRa("registrations", { ...form, idempotencyKey: crypto.randomUUID() });
        toast.success("Registration created");
        router.push(`/ra/registrations/${result.id}`);
      } catch (error) {
        toast.error("Unable to create registration", publicMasterError(error));
      }
    }}>
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} required />
      <RaPick resource="markets" label="Market" value={form.marketId} onChange={(marketId) => setForm({ ...form, marketId })} nameKey="marketName" />
      <RaPick resource="authorities" label="Authority" value={form.authorityId} onChange={(authorityId) => setForm({ ...form, authorityId })} nameKey="authorityName" />
      <Field label="Type">
        <Select value={form.registrationType} onValueChange={(registrationType) => setForm({ ...form, registrationType })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{registrationTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Applicant"><Input className="min-h-11" value={form.applicant} onChange={(event) => setForm({ ...form, applicant: event.target.value })} /></Field>
      <Field label="Manufacturer"><Input className="min-h-11" value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} /></Field>
      <Field label="MAH"><Input className="min-h-11" value={form.marketingAuthorizationHolder} onChange={(event) => setForm({ ...form, marketingAuthorizationHolder: event.target.value })} /></Field>
      <Field label="Expiry date"><Input className="min-h-11" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} /></Field>
    </FormShell>
  );
}

export function SubmissionForm() {
  const router = useRouter();
  const [form, setForm] = useState({ productId: "", registrationId: "", marketId: "", authorityId: "", submissionType: "", expectedResponseDate: "", remarks: "" });
  return (
    <FormShell permission="raSubmission:create" title="New submission" description="Submission numbers and versions are generated on the server. Historical versions are never overwritten." onSubmit={async () => {
      try {
        const result = await createRa("submissions", { ...form, idempotencyKey: crypto.randomUUID() });
        toast.success("Submission created");
        router.push(`/ra/submissions/${result.id}`);
      } catch (error) {
        toast.error("Unable to create submission", publicMasterError(error));
      }
    }}>
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} required />
      <RaPick resource="registrations" label="Registration" value={form.registrationId} onChange={(registrationId) => setForm({ ...form, registrationId })} nameKey="registrationNumber" />
      <RaPick resource="markets" label="Market" value={form.marketId} onChange={(marketId) => setForm({ ...form, marketId })} nameKey="marketName" />
      <RaPick resource="authorities" label="Authority" value={form.authorityId} onChange={(authorityId) => setForm({ ...form, authorityId })} nameKey="authorityName" />
      <Field label="Submission type"><Input className="min-h-11" value={form.submissionType} onChange={(event) => setForm({ ...form, submissionType: event.target.value })} /></Field>
      <Field label="Expected response"><Input className="min-h-11" type="date" value={form.expectedResponseDate} onChange={(event) => setForm({ ...form, expectedResponseDate: event.target.value })} /></Field>
    </FormShell>
  );
}

export function DossierForm() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", productId: "", registrationId: "", marketId: "" });
  return (
    <FormShell permission="raDossier:create" title="New dossier" description="Configurable sections are created automatically. Country-specific CTD formats are not hard-coded." onSubmit={async () => {
      const result = await createRa("dossiers", form);
      toast.success("Dossier created");
      router.push(`/ra/dossiers/${result.id}`);
    }}>
      <Field label="Title"><Input className="min-h-11" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} required />
      <RaPick resource="registrations" label="Registration" value={form.registrationId} onChange={(registrationId) => setForm({ ...form, registrationId })} nameKey="registrationNumber" />
      <RaPick resource="markets" label="Market" value={form.marketId} onChange={(marketId) => setForm({ ...form, marketId })} nameKey="marketName" />
    </FormShell>
  );
}

export function DocumentForm() {
  const router = useRouter();
  const [form, setForm] = useState({ documentTitle: "", documentType: "other", productId: "", expiryDate: "", remarks: "" });
  return (
    <FormShell permission="raDocument:create" title="New regulatory document" description="Approved versions are never overwritten." onSubmit={async () => {
      const result = await createRa("documents", form);
      toast.success("Document created");
      router.push(`/ra/documents/${result.id}`);
    }}>
      <Field label="Title"><Input className="min-h-11" value={form.documentTitle} onChange={(event) => setForm({ ...form, documentTitle: event.target.value })} /></Field>
      <Field label="Type">
        <Select value={form.documentType} onValueChange={(documentType) => setForm({ ...form, documentType })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{documentTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} />
      <Field label="Expiry date"><Input className="min-h-11" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} /></Field>
    </FormShell>
  );
}

export function LicenseForm() {
  const router = useRouter();
  const [form, setForm] = useState({ licenseType: "", issuingAuthority: "", plantId: "", site: "", issueDate: "", expiryDate: "", remarks: "" });
  return (
    <FormShell permission="raLicense:create" title="New license" description="Expiry status is calculated from configurable 90/60/30/7 day thresholds." onSubmit={async () => {
      const result = await createRa("licenses", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("License created");
      router.push(`/ra/licenses/${result.id}`);
    }}>
      <Field label="License type"><Input className="min-h-11" value={form.licenseType} onChange={(event) => setForm({ ...form, licenseType: event.target.value })} /></Field>
      <Field label="Issuing authority"><Input className="min-h-11" value={form.issuingAuthority} onChange={(event) => setForm({ ...form, issuingAuthority: event.target.value })} /></Field>
      <MasterPick entity="plants" label="Plant" value={form.plantId} onChange={(plantId) => setForm({ ...form, plantId })} />
      <Field label="Site"><Input className="min-h-11" value={form.site} onChange={(event) => setForm({ ...form, site: event.target.value })} /></Field>
      <Field label="Issue date"><Input className="min-h-11" type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} /></Field>
      <Field label="Expiry date"><Input className="min-h-11" type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} /></Field>
    </FormShell>
  );
}

export function RenewalForm() {
  const router = useRouter();
  const [form, setForm] = useState({ registrationId: "", currentExpiryDate: "", plannedSubmissionDate: "", remarks: "" });
  return (
    <FormShell permission="raRenewal:create" title="New renewal" description="Renewal numbers are generated on the server." onSubmit={async () => {
      const result = await createRa("renewals", form);
      toast.success("Renewal created");
      router.push(`/ra/renewals/${result.id}`);
    }}>
      <RaPick resource="registrations" label="Registration" value={form.registrationId} onChange={(registrationId) => setForm({ ...form, registrationId })} nameKey="registrationNumber" />
      <Field label="Current expiry"><Input className="min-h-11" type="date" value={form.currentExpiryDate} onChange={(event) => setForm({ ...form, currentExpiryDate: event.target.value })} /></Field>
      <Field label="Planned submission"><Input className="min-h-11" type="date" value={form.plannedSubmissionDate} onChange={(event) => setForm({ ...form, plannedSubmissionDate: event.target.value })} /></Field>
    </FormShell>
  );
}

export function QueryForm() {
  const router = useRouter();
  const [form, setForm] = useState({ submissionId: "", registrationId: "", authorityId: "", responseDueDate: "", queryCategory: "", description: "" });
  return (
    <FormShell permission="raQuery:create" title="New authority query" description="Queries can be assigned to QA, QC, production, and other departments." onSubmit={async () => {
      const result = await createRa("queries", { ...form, idempotencyKey: crypto.randomUUID() });
      toast.success("Query created");
      router.push(`/ra/queries/${result.id}`);
    }}>
      <RaPick resource="submissions" label="Submission" value={form.submissionId} onChange={(submissionId) => setForm({ ...form, submissionId })} nameKey="submissionNumber" />
      <RaPick resource="registrations" label="Registration" value={form.registrationId} onChange={(registrationId) => setForm({ ...form, registrationId })} nameKey="registrationNumber" />
      <RaPick resource="authorities" label="Authority" value={form.authorityId} onChange={(authorityId) => setForm({ ...form, authorityId })} nameKey="authorityName" />
      <Field label="Response due"><Input className="min-h-11" type="date" value={form.responseDueDate} onChange={(event) => setForm({ ...form, responseDueDate: event.target.value })} /></Field>
      <Field label="Category"><Input className="min-h-11" value={form.queryCategory} onChange={(event) => setForm({ ...form, queryCategory: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function CommitmentForm() {
  const router = useRouter();
  const [form, setForm] = useState({ sourceType: "other", sourceId: "", description: "", department: "", dueDate: "", priority: "normal" });
  return (
    <FormShell permission="raCommitment:create" title="New commitment" description="Commitments reference source records by type and ID." onSubmit={async () => {
      const result = await createRa("commitments", form);
      toast.success("Commitment created");
      router.push(`/ra/commitments/${result.id}`);
    }}>
      <Field label="Source">
        <Select value={form.sourceType} onValueChange={(sourceType) => setForm({ ...form, sourceType })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{commitmentSourceOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Source ID"><Input className="min-h-11" value={form.sourceId} onChange={(event) => setForm({ ...form, sourceId: event.target.value })} /></Field>
      <Field label="Department"><Input className="min-h-11" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></Field>
      <Field label="Due date"><Input className="min-h-11" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field></div>
    </FormShell>
  );
}

export function CommunicationForm() {
  const router = useRouter();
  const [form, setForm] = useState({ authorityId: "", productId: "", subject: "", summary: "", communicationType: "other", direction: "incoming" });
  return (
    <FormShell permission="raCommunication:create" title="Log communication" description="Incoming and outgoing authority correspondence remains immutable after posting." onSubmit={async () => {
      const result = await createRa("communications", form);
      toast.success("Communication logged");
      router.push(`/ra/communications/${result.id}`);
    }}>
      <RaPick resource="authorities" label="Authority" value={form.authorityId} onChange={(authorityId) => setForm({ ...form, authorityId })} nameKey="authorityName" />
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} />
      <Field label="Type">
        <Select value={form.communicationType} onValueChange={(communicationType) => setForm({ ...form, communicationType })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{communicationTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Direction">
        <Select value={form.direction} onValueChange={(direction) => setForm({ ...form, direction })}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{communicationDirectionOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Subject"><Input className="min-h-11" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></Field>
      <Field label="Summary"><Textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></Field>
    </FormShell>
  );
}

export function ArtworkForm() {
  const router = useRouter();
  const [form, setForm] = useState({ productId: "", customerId: "", marketId: "", artworkType: "label", remarks: "" });
  return (
    <FormShell permission="raArtwork:create" title="Artwork review" description="Regulatory workflow only. This is not an artwork design editor." onSubmit={async () => {
      const result = await createRa("artworks", form);
      toast.success("Artwork review created");
      router.push(`/ra/artworks/${result.id}`);
    }}>
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} required />
      <MasterPick entity="customers" label="Customer" value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} />
      <RaPick resource="markets" label="Market" value={form.marketId} onChange={(marketId) => setForm({ ...form, marketId })} nameKey="marketName" />
      <Field label="Artwork type"><Input className="min-h-11" value={form.artworkType} onChange={(event) => setForm({ ...form, artworkType: event.target.value })} /></Field>
    </FormShell>
  );
}

export function ChangeForm() {
  const router = useRouter();
  const [form, setForm] = useState({ title: "", source: "", effectiveDate: "", impactAssessment: "", affectedProducts: "", affectedMarkets: "", changeControlId: "" });
  return (
    <FormShell permission="raRegulatoryChange:create" title="Regulatory change" description="Tracks new requirements. Link an existing Phase 10 change control ID instead of duplicating CAPA/change-control records." onSubmit={async () => {
      const result = await createRa("changes", form);
      toast.success("Regulatory change created");
      router.push(`/ra/changes/${result.id}`);
    }}>
      <Field label="Title"><Input className="min-h-11" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
      <Field label="Source"><Input className="min-h-11" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /></Field>
      <Field label="Effective date"><Input className="min-h-11" type="date" value={form.effectiveDate} onChange={(event) => setForm({ ...form, effectiveDate: event.target.value })} /></Field>
      <Field label="Phase 10 change control ID"><Input className="min-h-11" value={form.changeControlId} onChange={(event) => setForm({ ...form, changeControlId: event.target.value })} /></Field>
      <Field label="Affected products"><Input className="min-h-11" value={form.affectedProducts} onChange={(event) => setForm({ ...form, affectedProducts: event.target.value })} /></Field>
      <Field label="Impact assessment"><Textarea value={form.impactAssessment} onChange={(event) => setForm({ ...form, impactAssessment: event.target.value })} /></Field>
    </FormShell>
  );
}

export function RequirementForm() {
  const router = useRouter();
  const [form, setForm] = useState({ customerId: "", productId: "", marketId: "", requirementType: "", requirementDescription: "", documentRequirement: "", testingRequirement: "", packagingRequirement: "", labelingRequirement: "" });
  return (
    <FormShell permission="raProduct:update" title="Customer regulatory requirement" description="Links customer, product, and market. Customer master is not duplicated." onSubmit={async () => {
      const result = await createRa("requirements", form);
      toast.success("Requirement saved");
      router.push(`/ra/requirements/${result.id}`);
    }}>
      <MasterPick entity="customers" label="Customer" value={form.customerId} onChange={(customerId) => setForm({ ...form, customerId })} required />
      <MasterPick entity="products" label="Product" value={form.productId} onChange={(productId) => setForm({ ...form, productId })} required />
      <RaPick resource="markets" label="Market" value={form.marketId} onChange={(marketId) => setForm({ ...form, marketId })} nameKey="marketName" />
      <Field label="Type"><Input className="min-h-11" value={form.requirementType} onChange={(event) => setForm({ ...form, requirementType: event.target.value })} /></Field>
      <div className="md:col-span-2"><Field label="Requirement"><Textarea value={form.requirementDescription} onChange={(event) => setForm({ ...form, requirementDescription: event.target.value })} /></Field></div>
    </FormShell>
  );
}
