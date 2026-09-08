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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComplaintList } from "@/components/complaints/complaint-list";
import { ComplaintWorkflowActions, type ComplaintWorkflowAction } from "@/components/complaints/complaint-workflow";
import { createComplaintRecord, getBatchComplaintView, getComplaint, getComplaintTrends, getCustomerComplaintProfile, getProductComplaintProfile, runComplaintAction } from "@/lib/complaints/client";
import {
  communicationStatusOptions,
  defaultCategoryOptions,
  investigationStatusOptions,
  labelFor,
  notificationStatusOptions,
  qaDecisionOptions,
  recallClassOptions,
  recallStatusOptions,
  riskFormulaOptions,
  rootCauseMethodOptions,
  sampleStatusOptions,
  severityOptions,
  statusOptions,
  withdrawalStatusOptions,
  workflowTone,
} from "@/lib/complaints/catalog";
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

export function ComplaintCaseList() {
  return <ComplaintList title="Complaints" description="Registered customer and market complaints. Numbers are server-generated." resource="cases" permission="complaintCase:read" createHref="/complaints/intake" createLabel="New intake" exportColumns={["complaintNumber", "customerId", "productId", "batchNumber", "category", "severity", "status", "dueDate"]} columns={[{ key: "complaintNumber", header: "Number" }, { key: "productName", header: "Product" }, { key: "batchNumber", header: "Batch" }, { key: "severity", header: "Severity", cell: (row) => <StatusCell options={severityOptions} value={row.severity} /> }, { key: "status", header: "Status", cell: (row) => <StatusCell options={statusOptions} value={row.status} /> }]} rowHref={(row) => `/complaints/cases/${row.id}`} />;
}
export function InvestigationList() {
  return <ComplaintList title="Investigations" description="Complaint investigations and assigned teams." resource="investigations" permission="complaintInvestigation:read" createHref="/complaints/investigations/new" createLabel="New investigation" exportColumns={["investigationNumber", "complaintNumber", "status", "dueDate"]} columns={[{ key: "investigationNumber", header: "Number" }, { key: "complaintNumber", header: "Complaint" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={investigationStatusOptions} value={row.status} /> }, { key: "dueDate", header: "Due" }]} rowHref={(row) => `/complaints/investigations/${row.id}`} />;
}
export function SampleList() {
  return <ComplaintList title="Complaint samples" description="Chain-of-custody samples linked to complaints." resource="samples" permission="complaintSample:read" createHref="/complaints/samples/new" createLabel="Register sample" exportColumns={["sampleNumber", "complaintId", "status", "receivedDate"]} columns={[{ key: "sampleNumber", header: "Number" }, { key: "complaintId", header: "Complaint" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={sampleStatusOptions} value={row.status} /> }]} rowHref={(row) => `/complaints/samples/${row.id}`} />;
}
export function CommunicationList() {
  return <ComplaintList title="Customer communication" description="Drafts require approval before send. Nothing is emailed automatically." resource="communications" permission="complaintCommunication:read" createHref="/complaints/communications/new" createLabel="New draft" exportColumns={["subject", "communicationType", "status", "complaintId"]} columns={[{ key: "subject", header: "Subject" }, { key: "communicationType", header: "Type" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={communicationStatusOptions} value={row.status} /> }]} rowHref={(row) => `/complaints/communications/${row.id}`} />;
}
export function RecallList() {
  return <ComplaintList title="Recalls" description="Potential recall assessments. The software does not decide that a recall is required." resource="recalls" permission="complaintRecall:read" createHref="/complaints/recalls/new" createLabel="New assessment" exportColumns={["recallNumber", "productId", "recallClass", "status"]} columns={[{ key: "recallNumber", header: "Number" }, { key: "productName", header: "Product" }, { key: "recallClass", header: "Class", cell: (row) => <StatusCell options={recallClassOptions} value={row.recallClass} /> }, { key: "status", header: "Status", cell: (row) => <StatusCell options={recallStatusOptions} value={row.status} /> }]} rowHref={(row) => `/complaints/recalls/${row.id}`} />;
}
export function WithdrawalList() {
  return <ComplaintList title="Withdrawals" description="Product withdrawals stored separately from recalls." resource="withdrawals" permission="complaintWithdrawal:read" createHref="/complaints/withdrawals/new" createLabel="Propose withdrawal" exportColumns={["withdrawalNumber", "productId", "status"]} columns={[{ key: "withdrawalNumber", header: "Number" }, { key: "productId", header: "Product" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={withdrawalStatusOptions} value={row.status} /> }]} rowHref={(row) => `/complaints/withdrawals/${row.id}`} />;
}
export function NotificationList() {
  return <ComplaintList title="Regulatory notifications" description="Assessment and submission preparation. Nothing is submitted automatically." resource="notifications" permission="complaintRegulatory:read" createHref="/complaints/notifications/new" createLabel="New assessment" exportColumns={["notificationNumber", "subject", "status"]} columns={[{ key: "notificationNumber", header: "Number" }, { key: "subject", header: "Subject" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={notificationStatusOptions} value={row.status} /> }]} rowHref={(row) => `/complaints/notifications/${row.id}`} />;
}

export function ComplaintCapaPage() {
  return (
    <RequirePermission permission="complaintCase:read">
      <div>
        <PageHeader title="Complaint CAPA" description="Complaints link to the existing Phase 10 CAPA engine. This page does not create a second CAPA system." actions={<Button asChild className="min-h-11"><Link href="/qa/capa">Open CAPA engine</Link></Button>} />
        <ComplaintList title="CAPA-linked complaints" description="Complaints that already reference a CAPA record." resource="cases" permission="complaintCase:read" exportColumns={["complaintNumber", "capaId", "status"]} columns={[{ key: "complaintNumber", header: "Complaint" }, { key: "capaId", header: "CAPA" }, { key: "status", header: "Status" }]} rowHref={(row) => `/complaints/cases/${row.id}`} emptyTitle="No CAPA-linked complaints" />
      </div>
    </RequirePermission>
  );
}

export function ComplaintRecordDetail({
  resource,
  id,
  permission,
  titleKey,
  statusOptions: options,
  actions,
}: {
  resource: string;
  id: string;
  permission: Permission;
  titleKey: string;
  statusOptions: Array<{ label: string; value: string }>;
  actions: ComplaintWorkflowAction[];
}) {
  return (
    <RequirePermission permission={permission}>
      <SimpleDetail resource={resource} id={id} titleKey={titleKey} statusOptions={options} actions={actions} />
    </RequirePermission>
  );
}

function SimpleDetail({ resource, id, titleKey, statusOptions: options, actions }: { resource: string; id: string; titleKey: string; statusOptions: Array<{ label: string; value: string }>; actions: ComplaintWorkflowAction[] }) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  function reload() {
    void getComplaint(resource, id)
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
      <PageHeader title={String(record[titleKey] || id)} description="Controlled complaint-module record." />
      <ComplaintWorkflowActions resource={resource} id={id} status={String(record.status)} statusOptions={options} actions={actions} onChanged={reload} />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {Object.entries(record)
          .filter(([key]) => !["searchIndex", "id", "_updateTime", "createdBy", "updatedBy"].includes(key))
          .slice(0, 16)
          .map(([key, value]) => (
            <Card key={key}>
              <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{key}</CardTitle></CardHeader>
              <CardContent className="text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</CardContent>
            </Card>
          ))}
      </div>
      {(extra.tasks as Row[] | undefined)?.length ? <Related title="Tasks" rows={extra.tasks as Row[]} render={(row) => `${row.description} · ${row.status}`} /> : null}
    </div>
  );
}

export function ComplaintWorkspace({ id }: { id: string }) {
  return (
    <RequirePermission permission="complaintCase:read">
      <WorkspaceInner id={id} />
    </RequirePermission>
  );
}

function WorkspaceInner({ id }: { id: string }) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [decision, setDecision] = useState("inconclusive");
  const [rationale, setRationale] = useState("");
  const [capaId, setCapaId] = useState("");
  const [changeId, setChangeId] = useState("");
  const [pvCaseId, setPvCaseId] = useState("");
  const [rca, setRca] = useState({ investigationId: "", method: "5_why", category: "", description: "", conclusion: "" });
  const [risk, setRisk] = useState({ method: "configurable_matrix", formula: "severity * occurrence * detectability", severity: "5", occurrence: "5", detectability: "5", rationale: "" });

  function reload() {
    void getComplaint("cases", id)
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
  if (error || !record) return <EmptyState title="Complaint not found" description={error || ""} />;

  const product = (extra.product || {}) as Record<string, unknown>;
  const customer = (extra.customer || {}) as Record<string, unknown>;
  const investigations = (extra.investigations as Row[]) || [];
  const samples = (extra.samples as Row[]) || [];
  const rootCauses = (extra.rootCauses as Row[]) || [];
  const risks = (extra.risks as Row[]) || [];
  const communications = (extra.communications as Row[]) || [];
  const recalls = (extra.recalls as Row[]) || [];
  const capas = (extra.capas as Row[]) || [];
  const pvCases = (extra.pvCases as Row[]) || [];
  const timeline = (extra.timeline as Array<Record<string, string>>) || [];
  const related = (extra.related as Row[]) || [];

  return (
    <div>
      <PageHeader title={String(record.complaintNumber || id)} description="Complaint workspace. QA confirms classification, severity, and decisions. The system does not autonomously decide recall or root cause." />
      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge label={labelFor(statusOptions, record.status)} tone={workflowTone(record.status)} />
        {record.severity ? <StatusBadge label={labelFor(severityOptions, record.severity)} tone={workflowTone(record.severity)} /> : null}
      </div>
      <ComplaintWorkflowActions
        resource="cases"
        id={id}
        status={String(record.status)}
        statusOptions={statusOptions}
        actions={[
          { action: "triage", label: "Triage", permission: "complaintCase:update" },
          { action: "investigation_pending", label: "Investigation pending", permission: "complaintCase:update" },
          { action: "under_investigation", label: "Under investigation", permission: "complaintCase:update" },
          { action: "qa_review", label: "QA review", permission: "complaintCase:update" },
          { action: "capa_pending", label: "CAPA pending", permission: "complaintCase:update" },
          { action: "recall_assessment", label: "Recall assessment", permission: "complaintCase:update" },
          { action: "customer_response_pending", label: "Customer response", permission: "complaintCase:update" },
          { action: "closure_review", label: "Closure review", permission: "complaintCase:update" },
          { action: "close", label: "Close", permission: "complaintCase:close", requireReason: true },
          { action: "reopen", label: "Reopen", permission: "complaintCase:reopen", requireReason: true, variant: "destructive" },
        ]}
        onChanged={reload}
      />
      <Tabs defaultValue="summary">
        <TabsList className="mb-4 flex h-auto flex-wrap">
          {["summary", "customer", "product", "batch", "classification", "investigation", "sample", "rca", "risk", "capa", "recall", "communication", "regulatory", "timeline"].map((tab) => (
            <TabsTrigger key={tab} value={tab}>{tab.replace(/_/g, " ")}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="summary">
          <div className="grid gap-3 md:grid-cols-2">
            {["complaintDescription", "sourceType", "urgency", "receivedDate", "assignedTo", "dueDate", "qaDecision"].map((key) => (
              <Card key={key}><CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{key}</CardTitle></CardHeader><CardContent className="text-sm">{String(record[key] ?? "—")}</CardContent></Card>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <Input className="min-h-11" placeholder="Assign to user ID" value={assignTo} onChange={(event) => setAssignTo(event.target.value)} />
            <Button className="min-h-11" onClick={() => void runComplaintAction("cases", id, "assign", { assignedTo: assignTo }).then(() => { toast.success("Assigned"); reload(); }).catch((err) => toast.error("Unable to assign", publicMasterError(err)))}>Assign</Button>
          </div>
        </TabsContent>
        <TabsContent value="customer">
          <Card><CardContent className="pt-4 text-sm">{String(customer.customerName || customer.name || record.customerId || "No customer linked")} · {String(customer.country || record.country || "")}</CardContent></Card>
          {record.customerId ? <Button asChild variant="outline" className="mt-3"><Link href={`/complaints/customers/${record.customerId}`}>Customer quality profile</Link></Button> : null}
        </TabsContent>
        <TabsContent value="product">
          <Card><CardContent className="pt-4 text-sm">{String(product.productCode || record.productCode || "—")} · {String(product.productName || record.productName || "—")} · {String(product.dosageForm || record.dosageForm || "")} {String(product.strength || record.strength || "")}</CardContent></Card>
          {record.productId ? <Button asChild variant="outline" className="mt-3"><Link href={`/complaints/products/${record.productId}`}>Product quality profile</Link></Button> : null}
        </TabsContent>
        <TabsContent value="batch">
          <p className="mb-3 text-sm">{extra.batchFound ? "Existing batch records are shown below." : String(extra.batchMessage || "No batch entered.")}</p>
          <Related title="Inventory batches" rows={(extra.batches as Row[]) || []} render={(row) => `${row.batchNumber} · ${row.qualityStatus || ""}`} />
          <Related title="Manufacturing orders" rows={(extra.orders as Row[]) || []} render={(row) => String(row.orderNumber || row.id)} />
          <Related title="BMR" rows={(extra.bmrs as Row[]) || []} render={(row) => String(row.bmrNumber || row.id)} />
          <Related title="QC tests" rows={(extra.qcTests as Row[]) || []} render={(row) => `${row.testName || row.id} · ${row.status}`} />
          <Related title="QA reviews" rows={(extra.qaReviews as Row[]) || []} render={(row) => `${row.reviewNumber || row.id} · ${row.status}`} />
          <Related title="Shipments / issues" rows={(extra.issues as Row[]) || []} render={(row) => `${row.issueNumber || row.id} · ${row.customerId || ""}`} />
          {record.batchNumber ? <Button asChild variant="outline" className="mt-3"><Link href={`/complaints/batches/${encodeURIComponent(String(record.batchNumber))}`}>Batch quality risk view</Link></Button> : null}
        </TabsContent>
        <TabsContent value="classification">
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="min-h-11"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>{defaultCategoryOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="min-h-11"><SelectValue placeholder="Severity (QA confirm)" /></SelectTrigger>
              <SelectContent>{severityOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button className="min-h-11" onClick={() => void runComplaintAction("cases", id, "classify", { category, severity }).then(() => { toast.success("Classification recorded"); reload(); }).catch((err) => toast.error("Unable to classify", publicMasterError(err)))}>Confirm classification</Button>
          <div className="mt-6 space-y-3">
            <p className="text-sm text-muted-foreground">QA decision requires a qualified reviewer. The system does not decide substantiation.</p>
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{qaDecisionOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea placeholder="Rationale" value={rationale} onChange={(event) => setRationale(event.target.value)} />
            <Button onClick={() => void runComplaintAction("cases", id, "qa_decision", { decision, rationale }).then(() => { toast.success("QA decision recorded"); reload(); }).catch((err) => toast.error("Unable to record decision", publicMasterError(err)))}>Record QA decision</Button>
          </div>
        </TabsContent>
        <TabsContent value="investigation">
          <Related title="Investigations" rows={investigations} render={(row) => `${row.investigationNumber} · ${row.status} · due ${row.dueDate || "—"}`} />
          <Button asChild className="mt-3 min-h-11"><Link href="/complaints/investigations/new">Open investigation</Link></Button>
        </TabsContent>
        <TabsContent value="sample">
          <Related title="Samples" rows={samples} render={(row) => `${row.sampleNumber} · ${row.status} · ${row.sampleLocation || ""}`} />
          <Button asChild className="mt-3 min-h-11"><Link href="/complaints/samples/new">Register sample</Link></Button>
        </TabsContent>
        <TabsContent value="rca">
          <p className="mb-3 text-sm text-muted-foreground">Qualified investigators record the conclusion. The software does not determine root cause.</p>
          <Related title="Root causes" rows={rootCauses} render={(row) => `${row.method} · ${row.conclusion}`} />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input className="min-h-11" placeholder="Investigation ID" value={rca.investigationId} onChange={(event) => setRca({ ...rca, investigationId: event.target.value })} />
            <Select value={rca.method} onValueChange={(method) => setRca({ ...rca, method })}>
              <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{rootCauseMethodOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="md:col-span-2"><Textarea placeholder="Description" value={rca.description} onChange={(event) => setRca({ ...rca, description: event.target.value })} /></div>
            <div className="md:col-span-2"><Textarea placeholder="Qualified conclusion" value={rca.conclusion} onChange={(event) => setRca({ ...rca, conclusion: event.target.value })} /></div>
          </div>
          <Button className="mt-3 min-h-11" onClick={() => void createComplaintRecord("rootCauses", rca).then(() => { toast.success("Root cause recorded"); reload(); }).catch((err) => toast.error("Unable to save", publicMasterError(err)))}>Save root cause</Button>
        </TabsContent>
        <TabsContent value="risk">
          <Related title="Risk assessments" rows={risks} render={(row) => `${row.riskLevel} · score ${row.riskScore} · ${row.formula}`} />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Select value={risk.formula} onValueChange={(formula) => setRisk({ ...risk, formula })}>
              <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{riskFormulaOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input className="min-h-11" placeholder="Severity 1-10" value={risk.severity} onChange={(event) => setRisk({ ...risk, severity: event.target.value })} />
            <Input className="min-h-11" placeholder="Occurrence 1-10" value={risk.occurrence} onChange={(event) => setRisk({ ...risk, occurrence: event.target.value })} />
            <Input className="min-h-11" placeholder="Detectability 1-10" value={risk.detectability} onChange={(event) => setRisk({ ...risk, detectability: event.target.value })} />
            <div className="md:col-span-2"><Textarea placeholder="Rationale" value={risk.rationale} onChange={(event) => setRisk({ ...risk, rationale: event.target.value })} /></div>
          </div>
          <Button className="mt-3 min-h-11" onClick={() => void createComplaintRecord("risks", { ...risk, complaintId: id }).then(() => { toast.success("Risk recorded"); reload(); }).catch((err) => toast.error("Unable to save", publicMasterError(err)))}>Save risk assessment</Button>
        </TabsContent>
        <TabsContent value="capa">
          <Related title="Linked CAPA" rows={capas} render={(row) => `${row.capaNumber || row.id} · ${row.status} · ${row.ownerId || ""}`} />
          <div className="mt-3 flex gap-2">
            <Input className="min-h-11" placeholder="Existing CAPA ID" value={capaId} onChange={(event) => setCapaId(event.target.value)} />
            <Button onClick={() => void runComplaintAction("cases", id, "link_capa", { capaId }).then(() => { toast.success("CAPA linked"); reload(); }).catch((err) => toast.error("Unable to link", publicMasterError(err)))}>Link CAPA</Button>
            <Button asChild variant="outline"><Link href="/qa/capa">Open CAPA</Link></Button>
          </div>
          <div className="mt-3 flex gap-2">
            <Input className="min-h-11" placeholder="Change control ID" value={changeId} onChange={(event) => setChangeId(event.target.value)} />
            <Button onClick={() => void runComplaintAction("cases", id, "link_change", { changeControlId: changeId }).then(() => { toast.success("Change control linked"); reload(); }).catch((err) => toast.error("Unable to link", publicMasterError(err)))}>Link change</Button>
          </div>
        </TabsContent>
        <TabsContent value="recall">
          <Related title="Recalls" rows={recalls} render={(row) => `${row.recallNumber} · ${row.status}`} />
          <Button asChild className="mt-3"><Link href="/complaints/recalls/new">Open recall assessment</Link></Button>
        </TabsContent>
        <TabsContent value="communication">
          <Related title="Communications" rows={communications} render={(row) => `${row.communicationType} · ${row.subject} · ${row.status}`} />
          <Button asChild className="mt-3"><Link href="/complaints/communications/new">Draft response</Link></Button>
        </TabsContent>
        <TabsContent value="regulatory">
          <Related title="PV cases" rows={pvCases} render={(row) => `${row.caseNumber || row.id} · ${row.status}`} />
          <div className="mt-3 flex gap-2">
            <Input className="min-h-11" placeholder="Existing PV case ID" value={pvCaseId} onChange={(event) => setPvCaseId(event.target.value)} />
            <Button onClick={() => void runComplaintAction("cases", id, "link_pv", { pvCaseId }).then(() => { toast.success("PV case linked"); reload(); }).catch((err) => toast.error("Unable to link", publicMasterError(err)))}>Link PV case</Button>
          </div>
          <Related title="Potential related complaints" rows={related} render={(row) => `${row.complaintNumber} · ${row.status}`} />
        </TabsContent>
        <TabsContent value="timeline">
          {timeline.map((item) => (
            <div key={`${item.date}-${item.label}`} className="mb-2 rounded-lg border p-3 text-sm">
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.date}</p>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function RecallWorkspace({ id }: { id: string }) {
  return (
    <RequirePermission permission="complaintRecall:read">
      <RecallInner id={id} />
    </RequirePermission>
  );
}

function RecallInner({ id }: { id: string }) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [batchNumber, setBatchNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [qtyReturned, setQtyReturned] = useState("");

  function reload() {
    void getComplaint("recalls", id)
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
  if (error || !record) return <EmptyState title="Recall not found" description={error || ""} />;

  const steps = ["potential", "assessment", "qa_review", "management_approval", "regulatory_review", "initiated", "notification", "retrieval", "reconciliation", "effectiveness_check", "closed"];
  const currentIndex = steps.indexOf(String(record.status));

  return (
    <div>
      <PageHeader title={String(record.recallNumber || id)} description="Recall quantities are displayed from recorded returns. Inventory is not edited from this screen." />
      <div className="mb-6 flex flex-wrap gap-2">
        {steps.map((step, index) => (
          <span key={step} className={`rounded-full border px-3 py-1 text-xs ${index <= currentIndex ? "border-primary bg-primary/10" : "text-muted-foreground"}`}>{step.replace(/_/g, " ")}</span>
        ))}
      </div>
      <ComplaintWorkflowActions
        resource="recalls"
        id={id}
        status={String(record.status)}
        statusOptions={recallStatusOptions}
        actions={[
          { action: "assessment", label: "Assessment", permission: "complaintRecall:update" },
          { action: "qa_review", label: "QA review", permission: "complaintRecall:update" },
          { action: "approve", label: "Approve next step", permission: "complaintRecall:approve", requireReason: true },
          { action: "notification", label: "Notification", permission: "complaintRecall:update" },
          { action: "retrieval", label: "Retrieval", permission: "complaintRecall:update" },
          { action: "reconciliation", label: "Reconciliation", permission: "complaintRecall:update" },
          { action: "reconcile", label: "Mark reconciled", permission: "complaintRecall:close", requireReason: true },
          { action: "close", label: "Close", permission: "complaintRecall:close", requireReason: true },
        ]}
        onChanged={reload}
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs">Risk / class</CardTitle></CardHeader><CardContent>{String(record.recallClass)}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs">Returned</CardTitle></CardHeader><CardContent>{String(extra.returnedQuantity || 0)}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs">Pending</CardTitle></CardHeader><CardContent>{String(extra.pendingQuantity || 0)}</CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-xs">Shipped</CardTitle></CardHeader><CardContent>{String(extra.shippedQuantity || 0)}</CardContent></Card>
      </div>
      <Related title="Affected batches" rows={(extra.batches as Row[]) || []} render={(row) => `${row.batchNumber} · affected ${row.affectedQuantity || "—"} ${row.batchMessage || ""}`} />
      <div className="my-3 flex gap-2">
        <Input className="min-h-11" placeholder="Batch number" value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} />
        <Button onClick={() => void runComplaintAction("recalls", id, "add_batch", { batchNumber }).then(() => { toast.success("Batch identified"); reload(); }).catch((err) => toast.error("Unable to add batch", publicMasterError(err)))}>Add batch</Button>
      </div>
      <Related title="Affected customers" rows={(extra.customers as Row[]) || []} render={(row) => `${row.customerName || row.customerId} · ${row.quantity || ""}`} />
      <div className="my-3 flex gap-2">
        <Input className="min-h-11" placeholder="Customer ID" value={customerId} onChange={(event) => setCustomerId(event.target.value)} />
        <Button onClick={() => void runComplaintAction("recalls", id, "add_customer", { customerId, batchNumber }).then(() => { toast.success("Customer confirmed"); reload(); }).catch((err) => toast.error("Unable to add customer", publicMasterError(err)))}>Confirm customer</Button>
      </div>
      <Related title="Returns" rows={(extra.returns as Row[]) || []} render={(row) => `${row.batchNumber || ""} · returned ${row.quantityReturned} · ${row.status}`} />
      <div className="my-3 flex gap-2">
        <Input className="min-h-11" placeholder="Quantity returned" value={qtyReturned} onChange={(event) => setQtyReturned(event.target.value)} />
        <Button onClick={() => void runComplaintAction("recalls", id, "record_return", { customerId, batchNumber, quantityReturned: qtyReturned }).then(() => { toast.success("Return recorded"); reload(); }).catch((err) => toast.error("Unable to record return", publicMasterError(err)))}>Record return</Button>
      </div>
    </div>
  );
}

export function TrendsPage() {
  return (
    <RequirePermission permission="complaints:read">
      <TrendsInner />
    </RequirePermission>
  );
}

function TrendsInner() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getComplaintTrends()
        .then((result) => setRows((result.extra.potential as Array<Record<string, unknown>>) || []))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (!rows.length && !error) return <LoadingState />;
  return (
    <div>
      <PageHeader title="Complaint trends" description="Clusters are Potential Trends until qualified review confirms them. The system does not create a confirmed safety signal." />
      {error ? <EmptyState title="Unable to load trends" description={error} /> : rows.map((row) => (
        <Card key={String(row.key)} className="mb-3"><CardContent className="pt-4 text-sm">Potential {String(row.type)} cluster · {String(row.key)} · {String(row.count)} complaints</CardContent></Card>
      ))}
    </div>
  );
}

export function ProductProfilePage({ id }: { id: string }) {
  return <ProfileLoader title="Product quality complaint profile" kind="product" id={id} />;
}
export function CustomerProfilePage({ id }: { id: string }) {
  return <ProfileLoader title="Customer quality profile" kind="customer" id={id} />;
}
export function BatchProfilePage({ batchNumber }: { batchNumber: string }) {
  return <ProfileLoader title="Batch quality risk view" kind="batch" id={batchNumber} />;
}

function ProfileLoader({ title, kind, id }: { title: string; kind: "product" | "customer" | "batch"; id: string }) {
  const [data, setData] = useState<{ record: Record<string, unknown>; extra: Record<string, unknown> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const request = kind === "product" ? getProductComplaintProfile(id) : kind === "customer" ? getCustomerComplaintProfile(id) : getBatchComplaintView(id);
      void request.then(setData).catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [kind, id]);
  if (!data && !error) return <LoadingState />;
  if (error || !data) return <EmptyState title="Unable to load profile" description={error || ""} />;
  return (
    <RequirePermission permission="complaints:read">
      <div>
        <PageHeader title={title} description="Read-only consolidated view. Existing master and quality records are referenced, not duplicated." />
        {data.record.batchMessage ? <p className="mb-4 text-sm text-amber-700">{String(data.record.batchMessage)}</p> : null}
        {Object.entries(data.extra).map(([key, value]) => (
          <Card key={key} className="mb-3">
            <CardHeader><CardTitle className="text-base">{key}</CardTitle></CardHeader>
            <CardContent className="text-sm">{Array.isArray(value) ? `${value.length} records` : JSON.stringify(value)}</CardContent>
          </Card>
        ))}
      </div>
    </RequirePermission>
  );
}
