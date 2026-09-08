"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PvList } from "@/components/pv/pv-list";
import { PvWorkflowActions, type PvWorkflowAction } from "@/components/pv/pv-workflow";
import { getPv, getProductSafety, runPvAction } from "@/lib/pv/client";
import {
  caseStatusOptions,
  commitmentStatusOptions,
  followUpStatusOptions,
  intakeStatusOptions,
  labelFor,
  priorityOptions,
  reportStatusOptions,
  signalStatusOptions,
  workflowTone,
} from "@/lib/pv/catalog";
import { SERIOUSNESS_CRITERIA } from "@/types/pv";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import { useAuth } from "@/hooks/use-auth";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

function StatusCell({ options, value }: { options: Array<{ label: string; value: string }>; value: unknown }) {
  return <StatusBadge label={labelFor(options, value)} tone={workflowTone(value)} />;
}

export function IntakeList() {
  return <PvList title="Case intake" description="Source information before case creation." resource="intakes" permission="pvIntake:read" createHref="/pv/intake/new" createLabel="New intake" exportColumns={["intakeNumber", "sourceType", "productId", "status", "urgency"]} columns={[{ key: "intakeNumber", header: "Number" }, { key: "sourceType", header: "Source" }, { key: "urgency", header: "Urgency" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={intakeStatusOptions} value={row.status} /> }]} rowHref={(row) => `/pv/intake/${row.id}`} />;
}
export function CaseList() {
  return <PvList title="Safety cases" description="Work queue. Patient identifiers are withheld from this list." resource="cases" permission="pvCase:read" createHref="/pv/cases/new" createLabel="New case" exportColumns={["caseNumber", "productId", "batchNumber", "eventTerm", "country", "priority", "status", "dueDate"]} columns={[{ key: "caseNumber", header: "Case" }, { key: "eventTerm", header: "Event" }, { key: "priority", header: "Priority", cell: (row) => <StatusCell options={priorityOptions} value={row.priority} /> }, { key: "status", header: "Status", cell: (row) => <StatusCell options={caseStatusOptions} value={row.status} /> }, { key: "dueDate", header: "Due", hideOnMobile: true }]} rowHref={(row) => `/pv/cases/${row.id}`} />;
}
export function FollowUpList() {
  return <PvList title="Follow-ups" description="Requested information and overdue responses." resource="followups" permission="pvFollowup:read" createHref="/pv/follow-ups/new" createLabel="Request follow-up" exportColumns={["followUpNumber", "caseId", "status", "dueDate"]} columns={[{ key: "followUpNumber", header: "Number" }, { key: "requestReason", header: "Reason" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={followUpStatusOptions} value={row.status} /> }, { key: "dueDate", header: "Due" }]} rowHref={(row) => `/pv/follow-ups/${row.id}`} />;
}
export function MedicalReviewQueue() {
  return <PvList title="Medical review" description="Cases in medical review. Assessments are reviewer tools, not autonomous decisions." resource="cases" permission="pvMedicalReview:read" exportColumns={["caseNumber", "status", "priority"]} columns={[{ key: "caseNumber", header: "Case" }, { key: "eventTerm", header: "Event" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={caseStatusOptions} value={row.status} /> }]} filterValues={{ status: "medical_review" }} rowHref={(row) => `/pv/cases/${row.id}`} />;
}
export function ReportList() {
  return <PvList title="Regulatory reports" description="Reporting packages. Nothing is submitted to an authority automatically." resource="reports" permission="pvRegulatoryReport:read" createHref="/pv/regulatory-reports/new" createLabel="New report" exportColumns={["reportNumber", "caseNumber", "status", "reportingDueDate"]} columns={[{ key: "reportNumber", header: "Number" }, { key: "caseNumber", header: "Case" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={reportStatusOptions} value={row.status} /> }]} rowHref={(row) => `/pv/regulatory-reports/${row.id}`} />;
}
export function RuleList() {
  return <PvList title="Reporting rules" description="Configurable jurisdiction windows." resource="rules" permission="pvRegulatoryReport:read" createHref="/pv/rules/new" createLabel="New rule" exportColumns={["ruleNumber", "caseType", "reportingWindow", "status"]} columns={[{ key: "ruleNumber", header: "Rule" }, { key: "caseType", header: "Type" }, { key: "reportingWindow", header: "Window (days)" }]} rowHref={(row) => `/pv/rules/${row.id}`} />;
}
export function SignalList() {
  return <PvList title="Safety signals" description="Potential signals pending qualified review." resource="signals" permission="pvSignal:read" createHref="/pv/signals/new" createLabel="New signal" exportColumns={["signalNumber", "productId", "eventTerm", "status"]} columns={[{ key: "signalNumber", header: "Number" }, { key: "eventTerm", header: "Event" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={signalStatusOptions} value={row.status} /> }]} rowHref={(row) => `/pv/signals/${row.id}`} />;
}
export function CommitmentList() {
  return <PvList title="Safety commitments" description="PV commitments linked to source records." resource="commitments" permission="pvCommitment:read" createHref="/pv/commitments/new" createLabel="New commitment" exportColumns={["commitmentNumber", "source", "status", "dueDate"]} columns={[{ key: "commitmentNumber", header: "Number" }, { key: "source", header: "Source" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={commitmentStatusOptions} value={row.status} /> }]} rowHref={(row) => `/pv/commitments/${row.id}`} />;
}

export function PvRecordDetail({
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
  actions: PvWorkflowAction[];
}) {
  return (
    <RequirePermission permission={permission}>
      <SimpleDetail resource={resource} id={id} titleKey={titleKey} statusOptions={statusOptions} actions={actions} />
    </RequirePermission>
  );
}

function SimpleDetail({ resource, id, titleKey, statusOptions, actions }: { resource: string; id: string; titleKey: string; statusOptions: Array<{ label: string; value: string }>; actions: PvWorkflowAction[] }) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  function reload() {
    void getPv(resource, id)
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
  }, [resource, id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) return <EmptyState title="Record not found" description={error || ""} />;

  return (
    <div>
      <PageHeader title={String(record[titleKey] || id)} description="Controlled pharmacovigilance record." />
      <PvWorkflowActions resource={resource} id={id} status={String(record.status)} statusOptions={statusOptions} actions={actions} onChanged={reload} />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {Object.entries(record)
          .filter(([key]) => !["searchIndex", "id", "_updateTime", "createdBy", "updatedBy"].includes(key))
          .slice(0, 14)
          .map(([key, value]) => (
            <Card key={key}>
              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{key}</CardTitle></CardHeader>
              <CardContent className="text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</CardContent>
            </Card>
          ))}
      </div>
      {(extra.tasks as Row[] | undefined)?.length ? <Related title="Questions" rows={extra.tasks as Row[]} render={(row) => `${row.question} · ${row.status}`} /> : null}
      {(extra.assessments as Row[] | undefined)?.length ? <Related title="Assessments" rows={extra.assessments as Row[]} render={(row) => `${row.assessment} · ${row.conclusion || ""}`} /> : null}
    </div>
  );
}

export function CaseWorkspace({ id }: { id: string }) {
  return (
    <RequirePermission permission="pvCase:read">
      <CaseInner id={id} />
    </RequirePermission>
  );
}

function CaseInner({ id }: { id: string }) {
  const { can } = useAuth();
  const sensitive = can("pvMedicalReview:read");
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [eventTerm, setEventTerm] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [seriousRationale, setSeriousRationale] = useState("");
  const [criteria, setCriteria] = useState<Record<string, boolean>>({});

  function reload() {
    void getPv("cases", id)
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
  if (error || !record) return <EmptyState title="Case not found" description={error || ""} />;

  const minimum = (record.minimumInformation || {}) as Record<string, unknown>;
  const patients = (extra.patients as Row[]) || [];
  const reporters = (extra.reporters as Row[]) || [];
  const products = (extra.products as Row[]) || [];
  const events = (extra.events as Row[]) || [];
  const timeline = (extra.timeline as Array<Record<string, string>>) || [];
  const followups = (extra.followups as Row[]) || [];
  const reports = (extra.reports as Row[]) || [];

  return (
    <div>
      <PageHeader title={String(record.caseNumber || id)} description="PV case workspace. Assessments require qualified reviewers. The software does not diagnose, treat, or decide reporting obligation." />
      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge label={labelFor(caseStatusOptions, record.status)} tone={workflowTone(record.status)} />
        <StatusBadge label={labelFor(priorityOptions, record.priority)} tone={workflowTone(record.priority)} />
        {record.seriousnessFlag ? <StatusBadge label={String(record.seriousnessFlag)} tone={workflowTone(record.seriousnessFlag)} /> : null}
      </div>
      <PvWorkflowActions
        resource="cases"
        id={id}
        status={String(record.status)}
        statusOptions={caseStatusOptions}
        actions={[
          { action: "triage", label: "Triage", permission: "pvCase:update" },
          { action: "process", label: "Processing", permission: "pvCase:update" },
          { action: "medical", label: "Medical review", permission: "pvCase:update" },
          { action: "regulatory", label: "Regulatory review", permission: "pvCase:update" },
          { action: "close", label: "Close", permission: "pvCase:close", requireReason: true },
          { action: "reopen", label: "Reopen", permission: "pvCase:reopen", requireReason: true },
        ]}
        onChanged={reload}
      />
      <Card className="mb-6">
        <CardHeader><CardTitle>Minimum information status</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>{minimum.identifiablePatient ? "✓" : "○"} Identifiable patient</p>
          <p>{minimum.identifiableReporter ? "✓" : "○"} Identifiable reporter</p>
          <p>{minimum.suspectProduct ? "✓" : "○"} Suspect product</p>
          <p>{minimum.adverseEvent ? "✓" : "○"} Adverse event</p>
          <p className="sm:col-span-2 font-medium">Status: {String(minimum.status || "requires_review")}. This is not a medical validity decision.</p>
        </CardContent>
      </Card>
      <div className="mb-6 flex flex-col gap-3 md:flex-row">
        <Input className="min-h-11" placeholder="Assign to user ID" value={assignTo} onChange={(event) => setAssignTo(event.target.value)} />
        <Button className="min-h-11" onClick={() => void runPvAction("cases", id, "assign", { assignedTo: assignTo }).then(() => { toast.success("Assigned"); reload(); }).catch((err) => toast.error("Unable to assign", publicMasterError(err)))}>Assign</Button>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="patient" className="hidden md:inline-flex">Patient</TabsTrigger>
          <TabsTrigger value="reporter" className="hidden md:inline-flex">Reporter</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="integrations">Traceability</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-3 md:grid-cols-2">
            {["productId", "batchNumber", "country", "sourceType", "dueDate", "assignedTo", "eventTerm"].map((key) => (
              <Card key={key}><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{key}</CardTitle></CardHeader><CardContent className="text-sm">{String(record[key] ?? "—")}</CardContent></Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="patient">
          {sensitive ? patients.map((row) => (
            <Card key={row.id} className="mb-3"><CardContent className="pt-4 text-sm">Reference {String(row.patientReference || "—")} · Age {String(row.age || "—")} {String(row.ageUnit || "")} · {String(row.sex || "")}</CardContent></Card>
          )) : <p className="text-sm text-muted-foreground">Patient information requires medical-review access and is hidden on small screens.</p>}
        </TabsContent>
        <TabsContent value="reporter">
          {sensitive ? reporters.map((row) => (
            <Card key={row.id} className="mb-3"><CardContent className="pt-4 text-sm">{String(row.reporterType)} · {String(row.organization || "")} · {String(row.country || "")}</CardContent></Card>
          )) : <p className="text-sm text-muted-foreground">Reporter information is restricted.</p>}
        </TabsContent>
        <TabsContent value="products">
          {products.map((row) => <RelatedCard key={row.id} title={`${row.productRole} · ${row.productName || row.productId}`} body={`Batch ${row.batchNumber || "—"} · ${row.dose || ""}`} />)}
          {!extra.batchFound && record.batchNumber ? <p className="text-sm text-amber-700">Batch not found</p> : null}
        </TabsContent>
        <TabsContent value="events">
          {events.map((row) => <RelatedCard key={row.id} title={String(row.eventTerm)} body={`${row.onsetDate || ""} · ${row.outcome} · severity ${row.severity}`} />)}
          <div className="mt-3 flex gap-2">
            <Input className="min-h-11" placeholder="Add event term" value={eventTerm} onChange={(event) => setEventTerm(event.target.value)} />
            <Button onClick={() => void runPvAction("cases", id, "add_event", { eventTerm, outcome: "unknown", severity: "unknown" }).then(() => { toast.success("Event added"); setEventTerm(""); reload(); }).catch((err) => toast.error("Unable to add event", publicMasterError(err)))}>Add</Button>
          </div>
        </TabsContent>
        <TabsContent value="assessments">
          <p className="mb-3 text-sm text-muted-foreground">Reviewer tools only. The system does not determine seriousness, expectedness, causality, or reporting obligation.</p>
          <div className="mb-4 grid gap-2 md:grid-cols-2">
            {SERIOUSNESS_CRITERIA.map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(criteria[item])} onChange={(event) => setCriteria({ ...criteria, [item]: event.target.checked })} />
                {item.replace(/_/g, " ")}
              </label>
            ))}
          </div>
          <Textarea className="mb-3" placeholder="Seriousness rationale" value={seriousRationale} onChange={(event) => setSeriousRationale(event.target.value)} />
          <Button className="mb-6 min-h-11" onClick={() => void runPvAction("cases", id, "seriousness", { rationale: seriousRationale, criteria: SERIOUSNESS_CRITERIA.map((criterion) => ({ criterion, selected: Boolean(criteria[criterion]) })) }).then(() => { toast.success("Seriousness recorded"); reload(); }).catch((err) => toast.error("Unable to record", publicMasterError(err)))}>Confirm seriousness</Button>
          <Textarea className="mb-3" placeholder="Medical review comment" value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void runPvAction("cases", id, "medical_review", { comment: reviewComment, requestFollowUp: true }).then(() => { toast.success("Follow-up requested"); reload(); }).catch((err) => toast.error("Unable to complete review", publicMasterError(err)))}>Request follow-up</Button>
            <Button onClick={() => void runPvAction("cases", id, "medical_review", { comment: reviewComment }).then(() => { toast.success("Review completed"); reload(); }).catch((err) => toast.error("Unable to complete review", publicMasterError(err)))}>Complete review</Button>
          </div>
        </TabsContent>
        <TabsContent value="timeline">
          {timeline.length ? timeline.map((item) => (
            <div key={`${item.date}-${item.label}`} className="mb-2 rounded-lg border p-3 text-sm">
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.date}</p>
            </div>
          )) : <p className="text-sm text-muted-foreground">No dated timeline events yet.</p>}
        </TabsContent>
        <TabsContent value="followups">
          {followups.map((row) => <Link key={row.id} href={`/pv/follow-ups/${row.id}`} className="mb-2 block rounded-lg border p-3 text-sm">{String(row.followUpNumber)} · {String(row.status)}</Link>)}
          {reports.map((row) => <Link key={row.id} href={`/pv/regulatory-reports/${row.id}`} className="mb-2 block rounded-lg border p-3 text-sm">{String(row.reportNumber)} · {String(row.status)}</Link>)}
        </TabsContent>
        <TabsContent value="integrations">
          <Related title="Manufacturing orders (referenced)" rows={(extra.orders as Row[]) || []} href={(row) => `/production/orders/${row.id}`} render={(row) => `${row.orderNumber || row.id}`} />
          <Related title="QA batch reviews (read-only)" rows={(extra.qaReviews as Row[]) || []} href={(row) => `/qa/reviews/${row.id}`} render={(row) => `${row.reviewNumber || row.id} · ${row.status}`} />
          <Related title="CAPA (referenced)" rows={(extra.capas as Row[]) || []} href={(row) => `/qa/capa/${row.id}`} render={(row) => `${row.capaNumber || row.id}`} />
          <Related title="Registrations (referenced)" rows={(extra.registrations as Row[]) || []} href={(row) => `/ra/registrations/${row.id}`} render={(row) => `${row.registrationNumber || row.id}`} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ProductSafetyPage() {
  return (
    <RequirePermission permission="pv:read">
      <ProductSafetyInner />
    </RequirePermission>
  );
}

function ProductSafetyInner() {
  const [productId, setProductId] = useState("");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!productId) return;
    try {
      setData(await getProductSafety(productId));
      setError(null);
    } catch (err) {
      setError(publicMasterError(err));
    }
  }

  const extra = (data?.extra || {}) as Record<string, unknown>;
  const cases = (extra.cases as Row[]) || [];

  return (
    <div>
      <PageHeader title="Product safety" description="Safety view over the existing product master. Products are not duplicated." />
      <div className="mb-4 flex gap-2">
        <Input className="min-h-11" placeholder="Product ID" value={productId} onChange={(event) => setProductId(event.target.value)} />
        <Button className="min-h-11" onClick={() => void load()}>Load</Button>
      </div>
      {error ? <EmptyState title="Unable to load product" description={error} /> : null}
      {data ? (
        <div>
          <p className="mb-4 text-sm">Serious cases: {String(extra.seriousCases || 0)}</p>
          {cases.map((row) => <Link key={row.id} href={`/pv/cases/${row.id}`} className="mb-2 block rounded-lg border p-3 text-sm">{String(row.caseNumber)} · {String(row.eventTerm)} · {String(row.status)}</Link>)}
        </div>
      ) : null}
    </div>
  );
}

function Related({ title, rows, render, href }: { title: string; rows: Row[]; render: (row: Row) => string; href?: (row: Row) => string }) {
  if (!rows.length) return null;
  return (
    <div className="mb-6 space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.map((row) => href ? (
        <Link key={row.id} href={href(row)} className="block rounded-lg border p-3 text-sm hover:bg-muted/40">{render(row)}</Link>
      ) : (
        <div key={row.id} className="rounded-lg border p-3 text-sm">{render(row)}</div>
      ))}
    </div>
  );
}

function RelatedCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="mb-2">
      <CardHeader className="pb-1"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="text-xs text-muted-foreground">{body}</CardContent>
    </Card>
  );
}
