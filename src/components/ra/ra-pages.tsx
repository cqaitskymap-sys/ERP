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
import { RaList } from "@/components/ra/ra-list";
import { RaWorkflowActions, type RaWorkflowAction } from "@/components/ra/ra-workflow";
import { getRa, getRaCalendar, runRaAction } from "@/lib/ra/client";
import {
  artworkStatusOptions,
  changeStatusOptions,
  commitmentStatusOptions,
  documentStatusOptions,
  labelFor,
  licenseStatusOptions,
  profileStatusOptions,
  queryStatusOptions,
  registrationStatusOptions,
  renewalStatusOptions,
  submissionStatusOptions,
  workflowTone,
} from "@/lib/ra/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

function StatusCell({ options, value }: { options: Array<{ label: string; value: string }>; value: unknown }) {
  return <StatusBadge label={labelFor(options, value)} tone={workflowTone(value)} />;
}

export function ProfileList() {
  return (
    <RaList title="Regulatory products" description="Regulatory profiles linked to the existing product master." resource="profiles" permission="raProduct:read" createHref="/ra/products/new" createLabel="New profile" exportColumns={["profileNumber", "productCode", "productName", "status"]} columns={[{ key: "productName", header: "Product" }, { key: "productCode", header: "Code" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={profileStatusOptions} value={row.status} /> }]} rowHref={(row) => `/ra/products/${row.id}`} />
  );
}
export function MarketList() {
  return <RaList title="Markets" description="Configurable markets. Countries are not hard-coded." resource="markets" permission="raMarket:read" createHref="/ra/markets/new" createLabel="New market" exportColumns={["marketCode", "marketName", "country", "region", "status"]} columns={[{ key: "marketCode", header: "Code" }, { key: "marketName", header: "Name" }, { key: "country", header: "Country" }, { key: "status", header: "Status" }]} rowHref={(row) => `/ra/markets/${row.id}`} />;
}
export function AuthorityList() {
  return <RaList title="Authorities" description="Configurable regulatory authorities." resource="authorities" permission="raAuthority:read" createHref="/ra/authorities/new" createLabel="New authority" exportColumns={["authorityName", "country", "region", "submissionMethod"]} columns={[{ key: "authorityName", header: "Authority" }, { key: "country", header: "Country" }, { key: "submissionMethod", header: "Method", hideOnMobile: true }]} rowHref={(row) => `/ra/authorities/${row.id}`} />;
}
export function RegistrationList() {
  return <RaList title="Registrations" description="Product registrations. Numbers are server-generated." resource="registrations" permission="raRegistration:read" createHref="/ra/registrations/new" createLabel="New registration" exportColumns={["registrationNumber", "productId", "marketId", "status", "expiryDate"]} columns={[{ key: "registrationNumber", header: "Number" }, { key: "productId", header: "Product" }, { key: "marketId", header: "Market" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={registrationStatusOptions} value={row.status} /> }, { key: "expiryDate", header: "Expiry", hideOnMobile: true }]} rowHref={(row) => `/ra/registrations/${row.id}`} />;
}
export function SubmissionList() {
  return <RaList title="Submissions" description="Versioned submissions. Historical versions are retained." resource="submissions" permission="raSubmission:read" createHref="/ra/submissions/new" createLabel="New submission" exportColumns={["submissionNumber", "productId", "status", "submissionVersion"]} columns={[{ key: "submissionNumber", header: "Number" }, { key: "productId", header: "Product" }, { key: "submissionVersion", header: "Version" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={submissionStatusOptions} value={row.status} /> }]} rowHref={(row) => `/ra/submissions/${row.id}`} />;
}
export function DossierList() {
  return <RaList title="Dossiers" description="Structured dossier sections without a hard-coded country format." resource="dossiers" permission="raDossier:read" createHref="/ra/dossiers/new" createLabel="New dossier" exportColumns={["dossierNumber", "title", "productId", "status"]} columns={[{ key: "dossierNumber", header: "Number" }, { key: "title", header: "Title" }, { key: "status", header: "Status" }]} rowHref={(row) => `/ra/dossiers/${row.id}`} />;
}
export function DocumentList() {
  return <RaList title="Regulatory documents" description="Controlled documents with version history." resource="documents" permission="raDocument:read" createHref="/ra/documents/new" createLabel="New document" exportColumns={["documentNumber", "documentTitle", "documentType", "status", "expiryDate"]} columns={[{ key: "documentNumber", header: "Number" }, { key: "documentTitle", header: "Title" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={documentStatusOptions} value={row.status} /> }]} rowHref={(row) => `/ra/documents/${row.id}`} />;
}
export function LicenseList() {
  return <RaList title="Licenses" description="Site and product licenses with configurable expiry thresholds." resource="licenses" permission="raLicense:read" createHref="/ra/licenses/new" createLabel="New license" exportColumns={["licenseNumber", "licenseType", "plantId", "status", "expiryDate"]} columns={[{ key: "licenseNumber", header: "Number" }, { key: "licenseType", header: "Type" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={licenseStatusOptions} value={row.status} /> }, { key: "expiryDate", header: "Expiry" }]} rowHref={(row) => `/ra/licenses/${row.id}`} />;
}
export function RenewalList() {
  return <RaList title="Renewals" description="Registration renewal planning and approval." resource="renewals" permission="raRenewal:read" createHref="/ra/renewals/new" createLabel="New renewal" exportColumns={["renewalNumber", "registrationId", "status", "plannedSubmissionDate"]} columns={[{ key: "renewalNumber", header: "Number" }, { key: "registrationId", header: "Registration" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={renewalStatusOptions} value={row.status} /> }]} rowHref={(row) => `/ra/renewals/${row.id}`} />;
}
export function QueryList() {
  return <RaList title="Queries" description="Authority queries with department assignment." resource="queries" permission="raQuery:read" createHref="/ra/queries/new" createLabel="New query" exportColumns={["queryNumber", "submissionId", "status", "responseDueDate"]} columns={[{ key: "queryNumber", header: "Number" }, { key: "queryCategory", header: "Category" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={queryStatusOptions} value={row.status} /> }, { key: "responseDueDate", header: "Due", hideOnMobile: true }]} rowHref={(row) => `/ra/queries/${row.id}`} />;
}
export function CommitmentList() {
  return <RaList title="Commitments" description="Regulatory commitments linked to source records." resource="commitments" permission="raCommitment:read" createHref="/ra/commitments/new" createLabel="New commitment" exportColumns={["commitmentNumber", "sourceType", "status", "dueDate"]} columns={[{ key: "commitmentNumber", header: "Number" }, { key: "sourceType", header: "Source" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={commitmentStatusOptions} value={row.status} /> }, { key: "dueDate", header: "Due" }]} rowHref={(row) => `/ra/commitments/${row.id}`} />;
}
export function CommunicationList() {
  return <RaList title="Communications" description="Incoming and outgoing authority correspondence." resource="communications" permission="raCommunication:read" createHref="/ra/communications/new" createLabel="Log communication" exportColumns={["communicationNumber", "subject", "direction", "communicationType"]} columns={[{ key: "communicationNumber", header: "Number" }, { key: "subject", header: "Subject" }, { key: "direction", header: "Direction" }, { key: "communicationType", header: "Type" }]} rowHref={(row) => `/ra/communications/${row.id}`} />;
}
export function ArtworkList() {
  return <RaList title="Artwork reviews" description="Regulatory artwork workflow. Not a design editor." resource="artworks" permission="raArtwork:read" createHref="/ra/artworks/new" createLabel="New artwork" exportColumns={["artworkNumber", "productId", "status"]} columns={[{ key: "artworkNumber", header: "Number" }, { key: "productId", header: "Product" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={artworkStatusOptions} value={row.status} /> }]} rowHref={(row) => `/ra/artworks/${row.id}`} />;
}
export function ChangeList() {
  return <RaList title="Regulatory changes" description="New requirements and impact tracking. Link Phase 10 change control instead of duplicating it." resource="changes" permission="raRegulatoryChange:read" createHref="/ra/changes/new" createLabel="New change" exportColumns={["changeNumber", "title", "status", "effectiveDate"]} columns={[{ key: "changeNumber", header: "Number" }, { key: "title", header: "Title" }, { key: "status", header: "Status", cell: (row) => <StatusCell options={changeStatusOptions} value={row.status} /> }]} rowHref={(row) => `/ra/changes/${row.id}`} />;
}
export function RequirementList() {
  return <RaList title="Customer regulatory requirements" description="Customer, product, and market requirements. Customer master is not duplicated." resource="requirements" permission="raProduct:read" createHref="/ra/requirements/new" createLabel="New requirement" exportColumns={["customerId", "productId", "marketId", "requirementType", "status"]} columns={[{ key: "customerId", header: "Customer" }, { key: "productId", header: "Product" }, { key: "requirementType", header: "Type" }, { key: "status", header: "Status" }]} rowHref={(row) => `/ra/requirements/${row.id}`} />;
}

export function RaRecordDetail({
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
  actions: RaWorkflowAction[];
}) {
  return (
    <RequirePermission permission={permission}>
      <DetailInner resource={resource} id={id} titleKey={titleKey} statusOptions={statusOptions} actions={actions} />
    </RequirePermission>
  );
}

function DetailInner({
  resource,
  id,
  titleKey,
  statusOptions,
  actions,
}: {
  resource: string;
  id: string;
  titleKey: string;
  statusOptions: Array<{ label: string; value: string }>;
  actions: RaWorkflowAction[];
}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState({ department: "qa", responsiblePerson: "", dueDate: "" });

  function reload() {
    void getRa(resource, id)
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

  const versions = (extra.versions as Row[]) || [];
  const sections = (extra.sections as Row[]) || [];
  const tasks = (extra.tasks as Row[]) || [];
  const submissions = (extra.submissions as Row[]) || [];
  const documents = (extra.documents as Row[]) || [];
  const queries = (extra.queries as Row[]) || [];
  const stability = (extra.stability as Row[]) || [];
  const specs = (extra.specs as Row[]) || [];
  const coas = (extra.coas as Row[]) || [];
  const orders = (extra.orders as Row[]) || [];
  const qaChanges = (extra.qaChanges as Row[]) || [];

  return (
    <div>
      <PageHeader title={String(record[titleKey] || id)} description="Controlled regulatory record. Approved history is not overwritten." />
      <RaWorkflowActions resource={resource} id={id} status={String(record.status)} statusOptions={statusOptions} actions={actions} onChanged={reload} />
      {resource === "queries" ? (
        <div className="mb-6 rounded-xl border p-4">
          <h2 className="mb-3 text-sm font-semibold">Assign department task</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <Input className="min-h-11" placeholder="Department (qa, qc, production…)" value={task.department} onChange={(event) => setTask({ ...task, department: event.target.value })} />
            <Input className="min-h-11" placeholder="Responsible person" value={task.responsiblePerson} onChange={(event) => setTask({ ...task, responsiblePerson: event.target.value })} />
            <Input className="min-h-11" type="date" value={task.dueDate} onChange={(event) => setTask({ ...task, dueDate: event.target.value })} />
          </div>
          <Button className="mt-3 min-h-11" onClick={() => {
            void runRaAction("queries", id, "assign", task)
              .then(() => { toast.success("Query assigned"); reload(); })
              .catch((err) => toast.error("Unable to assign", publicMasterError(err)));
          }}>Assign</Button>
        </div>
      ) : null}
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
      {versions.length ? <Related title="Submission versions (immutable)" rows={versions} render={(row) => `v${row.version} · ${row.status} · ${row.comments || ""}`} /> : null}
      {sections.length ? <Related title="Dossier sections" rows={sections} render={(row) => `${row.title || row.section} · ${row.status}`} /> : null}
      {tasks.length ? <Related title="Department tasks" rows={tasks} render={(row) => `${row.department} · ${row.responsiblePerson || "unassigned"} · ${row.status}`} /> : null}
      {submissions.length ? <Related title="Submissions" rows={submissions} href={(row) => `/ra/submissions/${row.id}`} render={(row) => `${row.submissionNumber} · ${row.status}`} /> : null}
      {documents.length ? <Related title="Documents" rows={documents} href={(row) => `/ra/documents/${row.id}`} render={(row) => `${row.documentNumber || row.documentTitle} · ${row.status}`} /> : null}
      {queries.length ? <Related title="Queries" rows={queries} href={(row) => `/ra/queries/${row.id}`} render={(row) => `${row.queryNumber} · ${row.status}`} /> : null}
      {orders.length ? <Related title="Manufacturing orders (referenced)" rows={orders} href={(row) => `/production/orders/${row.id}`} render={(row) => `${row.orderNumber || row.batchNumber} · ${row.status}`} /> : null}
      {specs.length ? <Related title="QC specifications (read-only)" rows={specs} href={(row) => `/qc/specifications/${row.id}`} render={(row) => `${row.specificationNumber || row.id} · ${row.status}`} /> : null}
      {coas.length ? <Related title="COAs (read-only)" rows={coas} href={(row) => `/qc/coa/${row.id}`} render={(row) => `${row.coaNumber || row.id} · ${row.status}`} /> : null}
      {stability.length ? <Related title="Stability studies (read-only)" rows={stability} href={(row) => `/qc/stability/${row.id}`} render={(row) => `${row.studyNumber || row.id} · ${row.status}`} /> : null}
      {qaChanges.length ? <Related title="QA change controls (referenced)" rows={qaChanges} href={(row) => `/qa/change-control/${row.id}`} render={(row) => `${row.changeNumber || row.id} · ${row.status}`} /> : null}
    </div>
  );
}

function Related({ title, rows, render, href }: { title: string; rows: Row[]; render: (row: Row) => string; href?: (row: Row) => string }) {
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

export function RaCalendarPage() {
  return (
    <RequirePermission permission="ra:read">
      <CalendarInner />
    </RequirePermission>
  );
}

function CalendarInner() {
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"month" | "week" | "day" | "list">("month");
  const [cursor, setCursor] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getRaCalendar()
        .then((result) => setEvents(result.events))
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((event) => !q || String(event.title || "").toLowerCase().includes(q) || String(event.type || "").includes(q));
  }, [events, search]);

  const visible = useMemo(() => {
    if (view === "list") return filtered;
    if (view === "day") return filtered.filter((event) => String(event.date) === cursor);
    if (view === "week") {
      const start = new Date(cursor);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return filtered.filter((event) => {
        const date = new Date(String(event.date));
        return date >= start && date < end;
      });
    }
    return filtered.filter((event) => String(event.date).slice(0, 7) === cursor.slice(0, 7));
  }, [filtered, view, cursor]);

  if (loading) return <LoadingState />;
  if (error) return <EmptyState title="Unable to load calendar" description={error} />;

  return (
    <div>
      <PageHeader title="Compliance calendar" description="Registration, license, document, query, commitment, and renewal deadlines from live records." />
      <Tabs value={view} onValueChange={(value) => setView(value as typeof view)}>
        <TabsList className="mb-4">
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <Input className="min-h-11 md:max-w-xs" type="date" value={cursor} onChange={(event) => setCursor(event.target.value)} />
          <Input className="min-h-11 md:max-w-sm" placeholder="Search events" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <TabsContent value={view}>
          {visible.length ? visible.map((event) => (
            <Link key={String(event.id)} href={String(event.href || "/ra")} className="mb-2 flex items-center justify-between rounded-xl border p-3 hover:bg-muted/40">
              <div>
                <p className="text-sm font-medium">{String(event.title)}</p>
                <p className="text-xs text-muted-foreground">{String(event.date)} · {String(event.type)}</p>
              </div>
              <StatusBadge label={String(event.status || event.recordStatus)} tone={workflowTone(event.status)} />
            </Link>
          )) : <p className="text-sm text-muted-foreground">No events in this view.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
