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
import { QaList } from "@/components/qa/qa-list";
import { QaWorkflowActions, type QaWorkflowAction } from "@/components/qa/qa-workflow";
import { getQa } from "@/lib/qa/client";
import {
  capaStatusOptions,
  changeStatusOptions,
  labelFor,
  qaDeviationStatusOptions,
  qaDocumentStatusOptions,
  qaReviewStatusOptions,
  workflowTone,
} from "@/lib/qa/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

function StatusCell({ options, value }: { options: Array<{ label: string; value: string }>; value: unknown }) {
  return <StatusBadge label={labelFor(options, value)} tone={workflowTone(value)} />;
}

export function BatchReviewList({ status }: { status?: string } = {}) {
  return (
    <QaList
      title="Batch review"
      description="QA batch dossier reviews. QC cannot release finished product from this list."
      resource="reviews"
      permission="qaBatchReview:read"
      createHref="/qa/reviews/new"
      createLabel="Open review"
      exportColumns={["reviewNumber", "batchNumber", "productId", "customerId", "status", "priority", "dueDate"]}
      filterValues={status ? { status } : {}}
      columns={[
        { key: "reviewNumber", header: "Review" },
        { key: "batchNumber", header: "Batch" },
        { key: "productId", header: "Product" },
        { key: "customerId", header: "Customer", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusCell options={qaReviewStatusOptions} value={row.status} /> },
        { key: "priority", header: "Priority", hideOnMobile: true },
      ]}
      rowHref={(row) => `/qa/reviews/${row.id}`}
    />
  );
}

export function DispositionList() {
  return (
    <QaList
      title="QA disposition"
      description="Release, hold, and reject decisions. Each decision is immutable after posting."
      resource="dispositions"
      permission="qaBatchRelease:read"
      exportColumns={["documentNumber", "batchNumber", "decision", "reason", "reviewedAt"]}
      columns={[
        { key: "documentNumber", header: "Number" },
        { key: "batchNumber", header: "Batch" },
        { key: "decision", header: "Decision" },
        { key: "reason", header: "Reason", hideOnMobile: true },
        { key: "reviewedAt", header: "Date", hideOnMobile: true },
      ]}
      rowHref={(row) => `/qa/reviews/${String(row.reviewId || "")}`}
    />
  );
}

export function HoldList() {
  return (
    <QaList
      title="Batch hold"
      description="Held batches remain out of released inventory until a later controlled decision."
      resource="reviews"
      permission="qa:read"
      filterValues={{ status: "held" }}
      exportColumns={["reviewNumber", "batchNumber", "productId", "status"]}
      columns={[
        { key: "reviewNumber", header: "Review" },
        { key: "batchNumber", header: "Batch" },
        { key: "productId", header: "Product" },
        { key: "status", header: "Status", cell: (row) => <StatusCell options={qaReviewStatusOptions} value={row.status} /> },
      ]}
      rowHref={(row) => `/qa/reviews/${row.id}`}
      emptyTitle="No held batches"
    />
  );
}

export function RejectionList() {
  return (
    <QaList
      title="Batch rejection"
      description="Rejected batches are retained for full traceability and are never deleted."
      resource="reviews"
      permission="qa:read"
      filterValues={{ status: "rejected" }}
      exportColumns={["reviewNumber", "batchNumber", "productId", "status"]}
      columns={[
        { key: "reviewNumber", header: "Review" },
        { key: "batchNumber", header: "Batch" },
        { key: "productId", header: "Product" },
        { key: "status", header: "Status", cell: (row) => <StatusCell options={qaReviewStatusOptions} value={row.status} /> },
      ]}
      rowHref={(row) => `/qa/reviews/${row.id}`}
      emptyTitle="No rejected batches"
    />
  );
}

export function ReleaseList() {
  return (
    <QaList
      title="Batch release"
      description="Released batches and the reviews that produced them. Inventory moves only through the inventory service."
      resource="reviews"
      permission="qaBatchRelease:read"
      filterValues={{ status: "released" }}
      exportColumns={["reviewNumber", "batchNumber", "productId", "customerId", "decidedAt"]}
      columns={[
        { key: "reviewNumber", header: "Review" },
        { key: "batchNumber", header: "Batch" },
        { key: "productId", header: "Product" },
        { key: "customerId", header: "Customer", hideOnMobile: true },
        { key: "decidedAt", header: "Released", hideOnMobile: true },
      ]}
      rowHref={(row) => `/qa/reviews/${row.id}`}
      emptyTitle="No released batches"
    />
  );
}

export function DeviationList() {
  return (
    <QaList
      title="Deviations"
      description="Quality deviations with investigation, severity, and CAPA linkage."
      resource="deviations"
      permission="qaDeviation:read"
      createHref="/qa/deviations/new"
      createLabel="New deviation"
      exportColumns={["deviationNumber", "batchNumber", "severity", "status", "source"]}
      columns={[
        { key: "deviationNumber", header: "Deviation" },
        { key: "batchNumber", header: "Batch" },
        { key: "severity", header: "Severity" },
        { key: "status", header: "Status", cell: (row) => <StatusCell options={qaDeviationStatusOptions} value={row.status} /> },
      ]}
      rowHref={(row) => `/qa/deviations/${row.id}`}
    />
  );
}

export function CapaList() {
  return (
    <QaList
      title="CAPA"
      description="Corrective and preventive actions linked to deviations, OOS, OOT, or other sources."
      resource="capas"
      permission="qaCapa:read"
      createHref="/qa/capa/new"
      createLabel="New CAPA"
      exportColumns={["capaNumber", "sourceType", "sourceId", "status", "dueDate", "ownerId"]}
      columns={[
        { key: "capaNumber", header: "CAPA" },
        { key: "sourceType", header: "Source" },
        { key: "status", header: "Status", cell: (row) => <StatusCell options={capaStatusOptions} value={row.status} /> },
        { key: "dueDate", header: "Due", hideOnMobile: true },
      ]}
      rowHref={(row) => `/qa/capa/${row.id}`}
    />
  );
}

export function ChangeControlList() {
  return (
    <QaList
      title="Change control"
      description="Controlled change requests. Implementation is not allowed before approval."
      resource="changes"
      permission="qaChangeControl:read"
      createHref="/qa/change-control/new"
      createLabel="New change"
      exportColumns={["changeNumber", "title", "changeType", "status", "dueDate"]}
      columns={[
        { key: "changeNumber", header: "Change" },
        { key: "title", header: "Title" },
        { key: "changeType", header: "Type" },
        { key: "status", header: "Status", cell: (row) => <StatusCell options={changeStatusOptions} value={row.status} /> },
      ]}
      rowHref={(row) => `/qa/change-control/${row.id}`}
    />
  );
}

export function DocumentReviewList() {
  return (
    <QaList
      title="Document review"
      description="QA review of SOPs, specifications, BMR, test methods, and quality agreements."
      resource="documents"
      permission="qaDocumentReview:read"
      createHref="/qa/documents/new"
      createLabel="New document"
      exportColumns={["documentNumber", "title", "documentType", "version", "status", "expiryDate"]}
      columns={[
        { key: "documentNumber", header: "Number" },
        { key: "title", header: "Title" },
        { key: "documentType", header: "Type" },
        { key: "status", header: "Status", cell: (row) => <StatusCell options={qaDocumentStatusOptions} value={row.status} /> },
      ]}
      rowHref={(row) => `/qa/documents/${row.id}`}
    />
  );
}

export function QaRecordDetail({
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
  actions: QaWorkflowAction[];
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
  actions: QaWorkflowAction[];
}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    void getQa(resource, id)
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
      <PageHeader
        title={String(record[titleKey] || id)}
        description="Controlled QA record. Corrections remain traceable and approved records are not overwritten."
        actions={
          record.sourceId && record.sourceType === "deviation" ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/qa/deviations/${String(record.sourceId)}`}>Open source</Link>
            </Button>
          ) : null
        }
      />
      <QaWorkflowActions
        resource={resource}
        id={id}
        status={String(record.status)}
        statusOptions={statusOptions}
        actions={actions}
        onChanged={reload}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(record)
          .filter(([key]) => !["searchIndex", "id", "_updateTime", "createdBy", "updatedBy"].includes(key))
          .slice(0, 18)
          .map(([key, value]) => (
            <Card key={key}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground">{key}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}

export function QaCompliancePage() {
  return (
    <RequirePermission permission="qaCompliance:read">
      <ComplianceInner />
    </RequirePermission>
  );
}

function ComplianceInner() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void import("@/lib/qa/client").then(({ getQaDashboard }) =>
        getQaDashboard()
          .then((result) => setStats(result.stats))
          .catch((err) => setError(publicMasterError(err)))
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!stats && !error) return <LoadingState />;
  if (error || !stats) return <EmptyState title="Unable to load compliance metrics" description={error || ""} />;
  const kpis = (stats.kpis || {}) as Record<string, number>;

  return (
    <div>
      <PageHeader
        title="Compliance dashboard"
        description="Open quality-system items from live Firestore records. This is a compliance operating picture, not a certification claim."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Open deviations" value={kpis.openDeviations} href="/qa/deviations" />
        <Metric label="Open CAPA" value={kpis.openCapa} href="/qa/capa" />
        <Metric label="Pending change controls" value={kpis.pendingChanges} href="/qa/change-control" />
        <Metric label="Expiring documents" value={kpis.expiringDocuments} href="/qa/documents" />
        <Metric label="Batches on hold" value={kpis.held} href="/qa/hold" />
        <Metric label="OOS pending" value={kpis.oosPending} href="/qc/oos" />
        <Metric label="OOT pending" value={kpis.ootPending} href="/qc/oot" />
        <Metric label="Released batches" value={kpis.released} href="/qa/release" />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Full audit management, training management, and validation management are reserved for later phases. Training-related blockers appear here only when those records exist.
      </p>
    </div>
  );
}

function Metric({ label, value, href }: { label: string; value?: number; href: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{Number(value || 0)}</p>
    </Link>
  );
}
