"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SqList } from "@/components/sq/sq-list";
import { SqWorkflowActions, type SqWorkflowAction } from "@/components/sq/sq-workflow";
import { createSq, getSq, getSqCalendar, runSqAction } from "@/lib/supplier-quality/client";
import {
  agreementTypeOptions,
  auditStatusOptions,
  auditTypeOptions,
  changeStatusOptions,
  documentStatusOptions,
  findingSeverityOptions,
  labelFor,
  materialQualStatusOptions,
  profileStatusOptions,
  qualificationStatusOptions,
  qualificationTypeOptions,
  questionnaireStatusOptions,
  requalStatusOptions,
  riskLevelOptions,
  suspensionStatusOptions,
  workflowTone,
} from "@/lib/supplier-quality/catalog";
import {
  AUDIT_TRANSITIONS,
  CHANGE_TRANSITIONS,
  PROFILE_TRANSITIONS,
  QUALIFICATION_TRANSITIONS,
  QUESTIONNAIRE_TRANSITIONS,
  REQUAL_TRANSITIONS,
  SUSPENSION_TRANSITIONS,
} from "@/lib/supplier-quality/status";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

function StatusCell({ options, value }: { options: Array<{ label: string; value: string }>; value: unknown }) {
  return <StatusBadge label={labelFor(options, value)} tone={workflowTone(value)} />;
}

function Related({ title, rows, render }: { title: string; rows: Row[]; render: (row: Row) => string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No {title.toLowerCase()} yet.</p>;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {rows.map((row) => <div key={row.id} className="rounded-lg border p-3 text-sm">{render(row)}</div>)}
    </div>
  );
}

function actionsFrom(
  map: Record<string, string[]>,
  current: string,
  permission: Permission,
  approvePermission?: Permission
): SqWorkflowAction[] {
  return (map[current] || []).map((next) => {
    const action = next === "approved" ? "approve" : next === "rejected" ? "reject" : next === "closed" ? "close" : next;
    const destructive = ["rejected", "disqualified", "expired"].includes(next);
    return {
      action,
      label: next.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      permission: ["approved", "rejected", "closed", "disqualified", "suspended"].includes(next) ? (approvePermission || permission) : permission,
      requireReason: ["approved", "rejected", "closed", "disqualified", "suspended", "expired"].includes(next),
      variant: destructive ? "destructive" : "outline",
    } satisfies SqWorkflowAction;
  });
}

export function ProfileList() {
  return <SqList title="Supplier quality profiles" description="Extends the existing Vendor Master. A second supplier record is not created." resource="profiles" permission="supplierQuality:read" createHref="/sq/profiles/new" createLabel="New profile" exportColumns={["supplierId", "status", "riskLevel", "performanceScore"]} columns={[{ key: "supplierId", header: "Vendor" }, { key: "riskLevel", header: "Risk", cell: (row) => <StatusCell options={riskLevelOptions} value={row.riskLevel} /> }, { key: "status", header: "Status", cell: (row) => <StatusCell options={profileStatusOptions} value={row.status} /> }, { key: "performanceScore", header: "Score" }]} rowHref={(row) => `/sq/profiles/${row.id}`} />;
}

export function QualificationList() {
  return <SqList title="Supplier qualifications" description="Numbers are generated server-side as SUP-Q-YYYY-#####." resource="qualifications" permission="supplierQualityQualification:read" createHref="/sq/qualifications/new" createLabel="New qualification" exportColumns={["qualificationNumber", "supplierId", "qualificationType", "status", "riskLevel", "targetDate"]} columns={[{ key: "qualificationNumber", header: "Number" }, { key: "supplierId", header: "Vendor" }, { key: "qualificationType", header: "Type", cell: (row) => <StatusCell options={qualificationTypeOptions} value={row.qualificationType} /> }, { key: "status", header: "Status", cell: (row) => <StatusCell options={qualificationStatusOptions} value={row.status} /> }]} rowHref={(row) => `/sq/qualifications/${row.id}`} />;
}

export function EvaluationList() {
  return <SqList title="Supplier evaluations" description="Configurable weights and stored methodology version." resource="evaluations" permission="supplierQualityEvaluation:read" createHref="/sq/evaluations/new" createLabel="New evaluation" exportColumns={["supplierId", "overallScore", "previousScore", "status", "evaluationDate"]} columns={[{ key: "supplierId", header: "Vendor" }, { key: "overallScore", header: "Score" }, { key: "previousScore", header: "Previous" }, { key: "status", header: "Status" }]} rowHref={(row) => `/sq/evaluations/${row.id}`} />;
}

export function AuditList() {
  return <SqList title="Supplier audits" description="Audit numbers are generated as SUP-AUD-YYYY-#####. Classification is recorded by the auditor." resource="audits" permission="supplierQualityAudit:read" createHref="/sq/audits/new" createLabel="Plan audit" exportColumns={["auditNumber", "supplierId", "auditType", "status", "plannedDate"]} columns={[{ key: "auditNumber", header: "Number" }, { key: "supplierId", header: "Vendor" }, { key: "auditType", header: "Type", cell: (row) => <StatusCell options={auditTypeOptions} value={row.auditType} /> }, { key: "status", header: "Status", cell: (row) => <StatusCell options={auditStatusOptions} value={row.status} /> }]} rowHref={(row) => `/sq/audits/${row.id}`} />;
}

export function DocumentList() {
  return <SqList title="Qualification documents" description="Configurable checklist. Expired documents are not automatically approved." resource="documents" permission="supplierQualityQualification:read" exportColumns={["supplierId", "documentType", "status", "expiryDate"]} columns={[{ key: "documentType", header: "Type" }, { key: "supplierId", header: "Vendor" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={documentStatusOptions} value={row.status} /> }, { key: "expiryDate", header: "Expiry" }]} rowHref={(row) => `/sq/qualifications/${String(row.qualificationId || "")}`} />;
}

export function CertificateList() {
  return <SqList title="Supplier certificates" description="GMP, ISO, and other certificates with expiry monitoring." resource="certificates" permission="supplierQualityCertificate:read" createHref="/sq/certificates/new" createLabel="Add certificate" exportColumns={["supplierId", "certificateType", "certificateNumber", "status", "expiryDate"]} columns={[{ key: "certificateNumber", header: "Number" }, { key: "certificateType", header: "Type" }, { key: "status", header: "Status" }, { key: "expiryDate", header: "Expiry" }]} rowHref={(row) => `/sq/certificates/${row.id}`} />;
}

export function AgreementList() {
  return <SqList title="Quality agreements" description="Supplier-quality agreement tracking, not a full contract system." resource="agreements" permission="supplierQualityAgreement:read" createHref="/sq/agreements/new" createLabel="New agreement" exportColumns={["agreementNumber", "supplierId", "agreementType", "status", "expiryDate"]} columns={[{ key: "agreementNumber", header: "Number" }, { key: "agreementType", header: "Type", cell: (row) => <StatusCell options={agreementTypeOptions} value={row.agreementType} /> }, { key: "status", header: "Status" }, { key: "expiryDate", header: "Expiry" }]} rowHref={(row) => `/sq/agreements/${row.id}`} />;
}

export function ChangeList() {
  return <SqList title="Supplier change notifications" description="Formal change control is linked to the existing Phase 10 engine when required." resource="changes" permission="supplierQualityChange:read" createHref="/sq/changes/new" createLabel="Log change" exportColumns={["changeNumber", "supplierId", "changeType", "status"]} columns={[{ key: "changeNumber", header: "Number" }, { key: "changeType", header: "Type" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={changeStatusOptions} value={row.status} /> }]} rowHref={(row) => `/sq/changes/${row.id}`} />;
}

export function PerformanceList() {
  return <SqList title="Supplier performance" description="Evaluation scores and trends used for scorecards." resource="evaluations" permission="supplierQualityEvaluation:read" createHref="/sq/evaluations/new" createLabel="New evaluation" exportColumns={["supplierId", "overallScore", "previousScore", "evaluationDate"]} columns={[{ key: "supplierId", header: "Vendor" }, { key: "overallScore", header: "Score" }, { key: "previousScore", header: "Previous" }, { key: "evaluationDate", header: "Date" }]} rowHref={(row) => `/sq/evaluations/${row.id}`} />;
}

export function RequalificationList() {
  return <SqList title="Requalification" description="Periodic requalification. Approval is a qualified QA decision." resource="requalifications" permission="supplierQualityRequalification:read" createHref="/sq/requalifications/new" createLabel="Open requalification" exportColumns={["requalificationNumber", "supplierId", "status", "dueDate"]} columns={[{ key: "requalificationNumber", header: "Number" }, { key: "supplierId", header: "Vendor" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={requalStatusOptions} value={row.status} /> }, { key: "dueDate", header: "Due" }]} rowHref={(row) => `/sq/requalifications/${row.id}`} />;
}

export function SuspendedList() {
  return <SqList title="Suspended and disqualified suppliers" description="Opening a proposal does not suspend the supplier. Authorized QA approval is required." resource="suspensions" permission="supplierQualitySuspension:read" createHref="/sq/suspended/new" createLabel="Propose suspension" exportColumns={["suspensionNumber", "supplierId", "reason", "status"]} columns={[{ key: "suspensionNumber", header: "Number" }, { key: "supplierId", header: "Vendor" }, { key: "reason", header: "Reason" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={suspensionStatusOptions} value={row.status} /> }]} rowHref={(row) => `/sq/suspended/${row.id}`} />;
}

export function ApprovedSupplierList() {
  return <SqList title="Approved supplier list" description="Supplier–material qualification for procurement reference. Material Master is not duplicated." resource="materials" permission="supplierQualityQualification:read" createHref="/sq/approved/new" createLabel="Qualify material" exportColumns={["supplierId", "materialId", "qualificationStatus", "expiryDate", "restrictions"]} columns={[{ key: "supplierId", header: "Vendor" }, { key: "materialId", header: "Material" }, { key: "qualificationStatus", header: "Status", cell: (row) => <StatusCell options={materialQualStatusOptions} value={row.qualificationStatus} /> }, { key: "expiryDate", header: "Expiry" }]} filterValues={{}} rowHref={(row) => `/sq/profiles?material=${row.materialId}`} />;
}

export function QuestionnaireList() {
  return <SqList title="Supplier questionnaires" description="Internal questionnaire workflow. Nothing is sent to an external portal." resource="questionnaires" permission="supplierQualityQuestionnaire:read" createHref="/sq/questionnaires/new" createLabel="New questionnaire" exportColumns={["title", "supplierId", "status"]} columns={[{ key: "title", header: "Title" }, { key: "supplierId", header: "Vendor" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={questionnaireStatusOptions} value={row.status} /> }]} rowHref={(row) => `/sq/questionnaires/${row.id}`} />;
}

export function SqCapaPage() {
  return (
    <RequirePermission permission="supplierQuality:read">
      <div>
        <PageHeader title="Supplier CAPA" description="Supplier issues link to the existing Phase 10 CAPA engine. This page does not create a second CAPA system." actions={<Button asChild className="min-h-11"><Link href="/qa/capa">Open CAPA engine</Link></Button>} />
        <p className="text-sm text-muted-foreground">Use source type <code>supplier_issue</code> when opening CAPA from a supplier quality finding.</p>
      </div>
    </RequirePermission>
  );
}

export function SqDeviationPage() {
  return (
    <RequirePermission permission="supplierQuality:read">
      <div>
        <PageHeader title="Supplier deviations" description="Supplier deviations use the existing Phase 10 deviation engine with source = supplier." actions={<Button asChild className="min-h-11"><Link href="/qa/deviations">Open deviation engine</Link></Button>} />
        <p className="text-sm text-muted-foreground">Do not create a parallel deviation record here. Preserve the existing QA workflow.</p>
      </div>
    </RequirePermission>
  );
}

export function SqRecordDetail({
  resource,
  id,
  permission,
  titleKey,
  statusOptions,
  actions,
}: {
  resource: string;
  id: string;
  permission: Permission;
  titleKey: string;
  statusOptions: Array<{ label: string; value: string }>;
  actions: SqWorkflowAction[];
}) {
  return (
    <RequirePermission permission={permission}>
      <SimpleDetail resource={resource} id={id} titleKey={titleKey} statusOptions={statusOptions} actions={actions} />
    </RequirePermission>
  );
}

function SimpleDetail({ resource, id, titleKey, statusOptions, actions }: { resource: string; id: string; titleKey: string; statusOptions: Array<{ label: string; value: string }>; actions: SqWorkflowAction[] }) {
  const [record, setRecord] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    void getSq(resource, id)
      .then((result) => setRecord(result.record))
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) return <EmptyState title="Record not found" description={error || ""} />;

  return (
    <div>
      <PageHeader title={String(record[titleKey] || id)} description="Controlled supplier-quality record." />
      <SqWorkflowActions resource={resource} id={id} status={String(record.status)} statusOptions={statusOptions} actions={actions.length ? actions : actionsFrom({}, String(record.status), "supplierQuality:update")} onChanged={reload} />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {Object.entries(record)
          .filter(([key]) => !["searchIndex", "id", "_updateTime", "createdBy", "updatedBy"].includes(key))
          .slice(0, 18)
          .map(([key, value]) => (
            <Card key={key}>
              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{key}</CardTitle></CardHeader>
              <CardContent className="text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}

export function QualificationDetail({ id }: { id: string }) {
  return <DynamicDetail resource="qualifications" id={id} permission="supplierQualityQualification:read" titleKey="qualificationNumber" statusOptions={qualificationStatusOptions} map={QUALIFICATION_TRANSITIONS} updatePermission="supplierQualityQualification:update" approvePermission="supplierQualityQualification:approve" />;
}

export function EvaluationDetail({ id }: { id: string }) {
  return <SqRecordDetail resource="evaluations" id={id} permission="supplierQualityEvaluation:read" titleKey="evaluationNumber" statusOptions={[{ label: "Draft", value: "draft" }, { label: "Approved", value: "approved" }]} actions={[{ action: "approve", label: "Approve evaluation", permission: "supplierQualityEvaluation:approve", requireReason: true }]} />;
}

export function CertificateDetail({ id }: { id: string }) {
  return <SqRecordDetail resource="certificates" id={id} permission="supplierQualityCertificate:read" titleKey="certificateNumber" statusOptions={documentStatusOptions} actions={[{ action: "approve", label: "Verify certificate", permission: "supplierQualityCertificate:approve", requireReason: true }]} />;
}

export function AgreementDetail({ id }: { id: string }) {
  return <SqRecordDetail resource="agreements" id={id} permission="supplierQualityAgreement:read" titleKey="agreementNumber" statusOptions={[{ label: "Draft", value: "draft" }, { label: "Approved", value: "approved" }]} actions={[{ action: "approve", label: "Approve agreement", permission: "supplierQualityAgreement:approve", requireReason: true }]} />;
}

export function ChangeDetail({ id }: { id: string }) {
  return <DynamicDetail resource="changes" id={id} permission="supplierQualityChange:read" titleKey="changeNumber" statusOptions={changeStatusOptions} map={CHANGE_TRANSITIONS} updatePermission="supplierQualityChange:update" approvePermission="supplierQualityChange:approve" extraActions={[{ action: "approve", label: "Approve change", permission: "supplierQualityChange:approve", requireReason: true }]} />;
}

export function SuspensionDetail({ id }: { id: string }) {
  return <DynamicDetail resource="suspensions" id={id} permission="supplierQualitySuspension:read" titleKey="suspensionNumber" statusOptions={suspensionStatusOptions} map={SUSPENSION_TRANSITIONS} updatePermission="supplierQualitySuspension:create" approvePermission="supplierQualitySuspension:approve" extraActions={[
    { action: "approve", label: "QA approve proposal", permission: "supplierQualitySuspension:approve", requireReason: true },
    { action: "suspend", label: "Suspend supplier", permission: "supplierQualitySuspension:approve", requireReason: true, variant: "destructive" },
    { action: "reactivate", label: "Reactivate", permission: "supplierQualitySuspension:approve", requireReason: true },
    { action: "disqualify", label: "Disqualify", permission: "supplierQualitySuspension:approve", requireReason: true, variant: "destructive" },
  ]} />;
}

export function RequalificationDetail({ id }: { id: string }) {
  return <DynamicDetail resource="requalifications" id={id} permission="supplierQualityRequalification:read" titleKey="requalificationNumber" statusOptions={requalStatusOptions} map={REQUAL_TRANSITIONS} updatePermission="supplierQualityRequalification:update" approvePermission="supplierQualityRequalification:approve" />;
}

export function QuestionnaireDetail({ id }: { id: string }) {
  return <DynamicDetail resource="questionnaires" id={id} permission="supplierQualityQuestionnaire:read" titleKey="title" statusOptions={questionnaireStatusOptions} map={QUESTIONNAIRE_TRANSITIONS} updatePermission="supplierQualityQuestionnaire:update" approvePermission="supplierQualityQuestionnaire:approve" />;
}

function DynamicDetail({
  resource,
  id,
  permission,
  titleKey,
  statusOptions,
  map,
  updatePermission,
  approvePermission,
  extraActions = [],
}: {
  resource: string;
  id: string;
  permission: Permission;
  titleKey: string;
  statusOptions: Array<{ label: string; value: string }>;
  map: Record<string, string[]>;
  updatePermission: Permission;
  approvePermission?: Permission;
  extraActions?: SqWorkflowAction[];
}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    void getSq(resource, id)
      .then((result) => setRecord(result.record))
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) return <EmptyState title="Record not found" description={error || ""} />;

  const generated = actionsFrom(map, String(record.status), updatePermission, approvePermission);
  const seen = new Set(generated.map((item) => item.action));
  const actions = [...generated, ...extraActions.filter((item) => !seen.has(item.action))];

  return (
    <RequirePermission permission={permission}>
      <div>
        <PageHeader title={String(record[titleKey] || id)} description="Controlled supplier-quality workflow." />
        <SqWorkflowActions resource={resource} id={id} status={String(record.status)} statusOptions={statusOptions} actions={actions} onChanged={reload} />
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {Object.entries(record)
            .filter(([key]) => !["searchIndex", "id", "_updateTime"].includes(key))
            .slice(0, 18)
            .map(([key, value]) => (
              <Card key={key}>
                <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{key}</CardTitle></CardHeader>
                <CardContent className="text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</CardContent>
              </Card>
            ))}
        </div>
      </div>
    </RequirePermission>
  );
}

export function ProfileWorkspace({ id }: { id: string }) {
  return (
    <RequirePermission permission="supplierQuality:read">
      <ProfileInner id={id} />
    </RequirePermission>
  );
}

function ProfileInner({ id }: { id: string }) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  function reload() {
    void getSq("profiles", id)
      .then((result) => {
        setRecord(result.record);
        setExtra(result.extra || {});
      })
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) return <EmptyState title="Profile not found" description={error || ""} />;

  const vendor = (extra.vendor || {}) as Record<string, unknown>;
  const asRows = (key: string) => (extra[key] as Row[]) || [];

  return (
    <div>
      <PageHeader
        title={String(vendor.name || vendor.vendorName || record.supplierId)}
        description={`Supplier quality 360 for ${String(vendor.code || vendor.vendorCode || record.supplierId)}. Vendor Master is not duplicated.`}
        actions={<Button asChild variant="outline" className="min-h-11"><Link href="/sq/risks/new">Record risk</Link></Button>}
      />
      <SqWorkflowActions resource="profiles" id={id} status={String(record.status)} statusOptions={profileStatusOptions} actions={actionsFrom(PROFILE_TRANSITIONS, String(record.status), "supplierQuality:update")} onChanged={reload} />
      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Info label="Vendor code" value={vendor.code || vendor.vendorCode} />
        <Info label="Country" value={vendor.country} />
        <Info label="Contact" value={vendor.contactName || vendor.email} />
        <Info label="Qualification" value={record.status} />
        <Info label="Risk" value={record.riskLevel} />
        <Info label="Score" value={record.performanceScore} />
        <Info label="Last evaluation" value={record.lastEvaluation} />
        <Info label="Next audit" value={record.nextAudit} />
      </div>
      <Tabs defaultValue="materials">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="qualification">Qualification</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="audits">Audits</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="issues">Deviations / CAPA</TabsTrigger>
          <TabsTrigger value="changes">Changes</TabsTrigger>
        </TabsList>
        <TabsContent value="materials"><Related title="Material qualifications" rows={asRows("materials")} render={(row) => `${row.materialId} · ${row.qualificationStatus}`} /></TabsContent>
        <TabsContent value="qualification"><Related title="Qualifications" rows={asRows("qualifications")} render={(row) => `${row.qualificationNumber} · ${row.status}`} /></TabsContent>
        <TabsContent value="risk"><Related title="Risk assessments" rows={asRows("risks")} render={(row) => `${row.riskLevel} · score ${row.riskScore}`} /></TabsContent>
        <TabsContent value="audits"><Related title="Audits" rows={asRows("audits")} render={(row) => `${row.auditNumber} · ${row.status}`} /></TabsContent>
        <TabsContent value="certificates"><Related title="Certificates" rows={asRows("certificates")} render={(row) => `${row.certificateType} · ${row.status}`} /></TabsContent>
        <TabsContent value="agreements"><Related title="Agreements" rows={asRows("agreements")} render={(row) => `${row.agreementNumber || row.agreementType} · ${row.status}`} /></TabsContent>
        <TabsContent value="performance"><Related title="Evaluations" rows={asRows("evaluations")} render={(row) => `Score ${row.overallScore} · previous ${row.previousScore || "—"}`} /></TabsContent>
        <TabsContent value="issues">
          <Related title="Deviations" rows={asRows("deviations")} render={(row) => `${row.deviationNumber || row.id} · ${row.status}`} />
          <div className="mt-4"><Related title="CAPA" rows={asRows("capas")} render={(row) => `${row.capaNumber || row.id} · ${row.status}`} /></div>
        </TabsContent>
        <TabsContent value="changes"><Related title="Supplier changes" rows={asRows("changes")} render={(row) => `${row.changeNumber} · ${row.status}`} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent className="text-sm">{String(value ?? "—")}</CardContent>
    </Card>
  );
}

export function AuditWorkspace({ id }: { id: string }) {
  return (
    <RequirePermission permission="supplierQualityAudit:read">
      <AuditInner id={id} />
    </RequirePermission>
  );
}

function AuditInner({ id }: { id: string }) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [finding, setFinding] = useState({ category: "Quality Management", description: "", severity: "observation", dueDate: "" });
  const [capaId, setCapaId] = useState("");

  function reload() {
    void getSq("audits", id)
      .then((result) => {
        setRecord(result.record);
        setExtra(result.extra || {});
      })
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) return <EmptyState title="Audit not found" description={error || ""} />;

  const findings = (extra.findings as Row[]) || [];
  const closed = String(record.status) === "closed";

  return (
    <div>
      <PageHeader title={String(record.auditNumber || id)} description="Supplier audit. Findings are classified by the auditor, not the software." />
      <SqWorkflowActions resource="audits" id={id} status={String(record.status)} statusOptions={auditStatusOptions} actions={actionsFrom(AUDIT_TRANSITIONS, String(record.status), "supplierQualityAudit:update", "supplierQualityAudit:approve")} onChanged={reload} />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <Info label="Supplier" value={record.supplierId} />
        <Info label="Type" value={record.auditType} />
        <Info label="Planned" value={record.plannedDate} />
        <Info label="Lead auditor" value={record.leadAuditor} />
        <Info label="Scope" value={record.scope} />
        <Info label="Conclusion" value={record.conclusion} />
      </div>
      <Related title="Findings" rows={findings} render={(row) => `${row.severity} · ${row.description}`} />
      {!closed ? (
        <div className="mt-6 space-y-3 rounded-xl border p-4">
          <h3 className="text-sm font-medium">Record finding</h3>
          <Input className="min-h-11" placeholder="Category" value={finding.category} onChange={(event) => setFinding({ ...finding, category: event.target.value })} />
          <Input className="min-h-11" placeholder="Description" value={finding.description} onChange={(event) => setFinding({ ...finding, description: event.target.value })} />
          <Input className="min-h-11" placeholder="Severity (critical/major/minor/observation/opportunity)" value={finding.severity} onChange={(event) => setFinding({ ...finding, severity: event.target.value })} />
          <Button className="min-h-11" onClick={() => void createSq("findings", { auditId: id, ...finding }).then(() => { toast.success("Finding recorded"); reload(); }).catch((err) => toast.error("Unable to save finding", publicMasterError(err)))}>Add finding</Button>
          <Input className="min-h-11" placeholder="Existing CAPA ID" value={capaId} onChange={(event) => setCapaId(event.target.value)} />
          <Button variant="outline" className="min-h-11" onClick={() => void runSqAction("audits", id, "link_capa", { capaId }).then(() => toast.success("CAPA linked")).catch((err) => toast.error("Unable to link CAPA", publicMasterError(err)))}>Link existing CAPA</Button>
        </div>
      ) : <p className="mt-4 text-sm text-muted-foreground">Closed audits cannot be silently modified.</p>}
      <p className="mt-2 text-xs text-muted-foreground">Finding severities: {findingSeverityOptions.map((item) => item.label).join(", ")}</p>
    </div>
  );
}

export function SqCalendarPage() {
  return (
    <RequirePermission permission="supplierQuality:read">
      <CalendarInner />
    </RequirePermission>
  );
}

function CalendarInner() {
  const [events, setEvents] = useState<Array<{ date: string; title: string; type: string }>>([]);
  const [view, setView] = useState<"list" | "month" | "week" | "day">("list");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getSqCalendar()
        .then((result) => setEvents(((result.extra?.events as Array<{ date: string; title: string; type: string }>) || [])))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    return events.filter((event) => {
      const date = new Date(event.date);
      if (Number.isNaN(date.getTime())) return false;
      if (view === "day") return date.toDateString() === now.toDateString();
      if (view === "week") {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        return date >= start && date < end;
      }
      if (view === "month") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [events, view]);

  if (error) return <EmptyState title="Unable to load calendar" description={error} />;

  return (
    <div>
      <PageHeader title="Supplier compliance calendar" description="Qualification, audit, certificate, agreement, and requalification due dates from Firestore." />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["month", "week", "day", "list"] as const).map((item) => (
          <Button key={item} variant={view === item ? "default" : "outline"} className="min-h-11" onClick={() => setView(item)}>{item}</Button>
        ))}
      </div>
      {!filtered.length ? <p className="text-sm text-muted-foreground">No events in this view.</p> : filtered.map((event, index) => (
        <div key={`${event.date}-${event.title}-${index}`} className="mb-2 rounded-lg border p-3 text-sm">
          <span className="font-medium">{event.date.slice(0, 10)}</span> · {event.type} · {event.title}
        </div>
      ))}
    </div>
  );
}
