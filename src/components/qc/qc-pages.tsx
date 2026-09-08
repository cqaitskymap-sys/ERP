"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { AuditHistory } from "@/components/products/audit-history";
import { QcList } from "@/components/qc/qc-list";
import { QcWorkflowActions, type QcWorkflowAction } from "@/components/qc/qc-workflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createQc, getQc, runQcAction } from "@/lib/qc/client";
import {
  assignmentStatusOptions,
  instrumentStatusOptions,
  labelFor,
  oosStatusOptions,
  ootStatusOptions,
  qcPriorityOptions,
  sampleConditionOptions,
  sampleRequestStatusOptions,
  sampleSourceOptions,
  sampleStatusOptions,
  specStatusOptions,
  standardStatusOptions,
  testRequestStatusOptions,
  workflowTone,
} from "@/lib/qc/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

function StatusFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <Select value={value || "all"} onValueChange={(next) => onChange(next === "all" ? "" : next)}>
      <SelectTrigger className="min-h-11 w-48"><SelectValue placeholder="Status" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SampleRequestList() {
  const [status, setStatus] = useState("");
  return (
    <QcList
      title="Sample requests"
      description="QC sample requests from goods receipts, manufacturing, and configured sources."
      resource="sampleRequests"
      permission="qcSample:read"
      createHref="/qc/sample-requests/new"
      createLabel="New request"
      exportColumns={["sampleRequestNumber", "sourceType", "productId", "materialId", "batchNumber", "priority", "status"]}
      filterValues={{ status }}
      filters={<StatusFilter value={status} onChange={setStatus} options={sampleRequestStatusOptions} />}
      rowHref={(row) => `/qc/sample-requests/${row.id}`}
      columns={[
        { key: "sampleRequestNumber", header: "Request" },
        { key: "sourceType", header: "Source", cell: (row) => labelFor(sampleSourceOptions, row.sourceType) },
        { key: "batchNumber", header: "Batch" },
        { key: "priority", header: "Priority", hideOnMobile: true, cell: (row) => labelFor(qcPriorityOptions, row.priority) },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(sampleRequestStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function SampleList() {
  const [status, setStatus] = useState("");
  return (
    <QcList
      title="Sample management"
      description="Collection, receipt, and registration. Unacceptable samples require controlled disposition."
      resource="samples"
      permission="qcSample:read"
      createHref="/qc/samples/new"
      createLabel="Register sample"
      exportColumns={["sampleNumber", "sourceType", "productId", "materialId", "batchNumber", "sampledAt", "receivedAt", "status"]}
      filterValues={{ status }}
      filters={<StatusFilter value={status} onChange={setStatus} options={sampleStatusOptions} />}
      rowHref={(row) => `/qc/samples/${row.id}`}
      columns={[
        { key: "sampleNumber", header: "Sample" },
        { key: "sourceType", header: "Source", cell: (row) => labelFor(sampleSourceOptions, row.sourceType) },
        { key: "productId", header: "Product/Material", cell: (row) => String(row.productId || row.materialId || "—") },
        { key: "batchNumber", header: "Batch" },
        { key: "sampledAt", header: "Sample date", hideOnMobile: true, cell: (row) => String(row.sampledAt || "").slice(0, 10) || "—" },
        { key: "receivedAt", header: "Received", hideOnMobile: true, cell: (row) => String(row.receivedAt || "").slice(0, 10) || "—" },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(sampleStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
        { key: "priority", header: "Priority", hideOnMobile: true },
      ]}
    />
  );
}

export function TestRequestList() {
  const [status, setStatus] = useState("");
  return (
    <QcList
      title="Test requests"
      description="Laboratory test requests linked to samples and specification versions."
      resource="testRequests"
      permission="qcTest:read"
      createHref="/qc/test-requests/new"
      createLabel="New test request"
      exportColumns={["testRequestNumber", "sampleId", "batchNumber", "status", "dueDate"]}
      filterValues={{ status }}
      filters={<StatusFilter value={status} onChange={setStatus} options={testRequestStatusOptions} />}
      rowHref={(row) => `/qc/test-requests/${row.id}`}
      columns={[
        { key: "testRequestNumber", header: "Request" },
        { key: "batchNumber", header: "Batch" },
        { key: "dueDate", header: "Due", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(testRequestStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function AssignmentList() {
  return (
    <QcList
      title="Test assignments"
      description="Supervisor assignments of tests to qualified analysts."
      resource="assignments"
      permission="qcTest:read"
      createHref="/qc/assignments/new"
      createLabel="Assign test"
      exportColumns={["testRequestId", "analystId", "dueDate", "priority", "status"]}
      rowHref={(row) => `/qc/test-requests/${String(row.testRequestId || "")}`}
      columns={[
        { key: "testRequestId", header: "Test request" },
        { key: "analystId", header: "Analyst" },
        { key: "dueDate", header: "Due", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(assignmentStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function SpecificationList() {
  const [status, setStatus] = useState("");
  return (
    <QcList
      title="Specifications"
      description="Version-controlled acceptance criteria. Historical results keep the specification version used."
      resource="specifications"
      permission="qcSpecification:read"
      createHref="/qc/specifications/new"
      createLabel="New specification"
      exportColumns={["specificationNumber", "productId", "materialId", "version", "status"]}
      filterValues={{ status }}
      filters={<StatusFilter value={status} onChange={setStatus} options={specStatusOptions} />}
      rowHref={(row) => `/qc/specifications/${row.id}`}
      columns={[
        { key: "specificationNumber", header: "Specification" },
        { key: "version", header: "Version" },
        { key: "productId", header: "Product", hideOnMobile: true },
        { key: "materialId", header: "Material", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(specStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function MethodList() {
  const [status, setStatus] = useState("");
  return (
    <QcList
      title="Test methods"
      description="Controlled laboratory methods. Results retain the method version used."
      resource="methods"
      permission="qcTestMethod:read"
      createHref="/qc/methods/new"
      createLabel="New method"
      exportColumns={["methodNumber", "methodName", "version", "status"]}
      filterValues={{ status }}
      filters={<StatusFilter value={status} onChange={setStatus} options={specStatusOptions} />}
      rowHref={(row) => `/qc/methods/${row.id}`}
      columns={[
        { key: "methodNumber", header: "Method" },
        { key: "methodName", header: "Name" },
        { key: "version", header: "Version" },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(specStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function TestList() {
  const [status, setStatus] = useState("");
  return (
    <QcList
      title="Laboratory tests"
      description="Open the workbench to enter results. Calculations and pass/fail evaluation run on the server."
      resource="tests"
      permission="qcTest:read"
      exportColumns={["testNumber", "sampleId", "batchNumber", "analystId", "status", "overallResult"]}
      filterValues={{ status }}
      filters={<StatusFilter value={status} onChange={setStatus} options={testRequestStatusOptions} />}
      rowHref={(row) => `/qc/tests/${row.id}`}
      columns={[
        { key: "testNumber", header: "Test" },
        { key: "batchNumber", header: "Batch" },
        { key: "analystId", header: "Analyst", hideOnMobile: true },
        { key: "overallResult", header: "Result", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(testRequestStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function ResultList() {
  return (
    <QcList
      title="Test results"
      description="Immutable result history. Corrections create a new version and never overwrite approved values."
      resource="results"
      permission="qcTest:read"
      exportColumns={["parameterName", "enteredResult", "outcome", "batchNumber", "testId"]}
      rowHref={(row) => `/qc/tests/${String(row.testId || "")}`}
      columns={[
        { key: "parameterName", header: "Parameter" },
        { key: "enteredResult", header: "Result" },
        { key: "outcome", header: "Outcome", cell: (row) => <StatusBadge label={String(row.outcome || "pending")} tone={workflowTone(row.outcome)} /> },
        { key: "batchNumber", header: "Batch", hideOnMobile: true },
      ]}
    />
  );
}

export function OosList() {
  const [status, setStatus] = useState("");
  return (
    <QcList
      title="Out of specification"
      description="OOS foundation. Full investigation and CAPA belong to a future QA phase."
      resource="oos"
      permission="qcOos:read"
      createHref="/qc/oos/new"
      createLabel="New OOS"
      exportColumns={["oosNumber", "batchNumber", "parameter", "observedResult", "status"]}
      filterValues={{ status }}
      filters={<StatusFilter value={status} onChange={setStatus} options={oosStatusOptions} />}
      rowHref={(row) => `/qc/oos/${row.id}`}
      columns={[
        { key: "oosNumber", header: "OOS" },
        { key: "batchNumber", header: "Batch" },
        { key: "parameter", header: "Parameter" },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(oosStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function OotList() {
  return (
    <QcList
      title="Out of trend"
      description="Controlled OOT records. Unusual values are not classified automatically."
      resource="oot"
      permission="qcOot:read"
      createHref="/qc/oot/new"
      createLabel="New OOT"
      exportColumns={["ootNumber", "batchNumber", "parameter", "currentResult", "status"]}
      rowHref={() => "/qc/oot"}
      columns={[
        { key: "ootNumber", header: "OOT" },
        { key: "batchNumber", header: "Batch" },
        { key: "parameter", header: "Parameter" },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(ootStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function RetestList() {
  return (
    <QcList
      title="Retesting"
      description="Controlled retest history. Original results remain intact."
      resource="retests"
      permission="qcTest:read"
      createHref="/qc/retests/new"
      createLabel="Request retest"
      exportColumns={["retestNumber", "originalTestId", "reason", "status"]}
      rowHref={(row) => `/qc/tests/${String(row.newTestId || row.originalTestId || "")}`}
      columns={[
        { key: "retestNumber", header: "Retest" },
        { key: "originalTestId", header: "Original test" },
        { key: "reason", header: "Reason", hideOnMobile: true },
      ]}
    />
  );
}

export function CoaList() {
  return (
    <QcList
      title="Certificates of analysis"
      description="Generate only after QC approval. Approved COAs cannot be edited; corrections create a new version."
      resource="coas"
      permission="qcCoa:read"
      createHref="/qc/coa/new"
      createLabel="Generate COA"
      exportColumns={["coaNumber", "productId", "batchNumber", "customerId", "status", "version"]}
      rowHref={(row) => `/qc/coa/${row.id}`}
      columns={[
        { key: "coaNumber", header: "COA" },
        { key: "batchNumber", header: "Batch" },
        { key: "productId", header: "Product", hideOnMobile: true },
        { key: "version", header: "Version" },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={String(row.status || "draft")} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function StabilityList() {
  return (
    <QcList
      title="Stability studies"
      description="Stability study foundation. Chamber monitoring is not implemented in this phase."
      resource="stability"
      permission="qcStability:read"
      createHref="/qc/stability/new"
      createLabel="New study"
      exportColumns={["studyNumber", "productId", "batchNumber", "condition", "status"]}
      rowHref={(row) => `/qc/stability/${row.id}`}
      columns={[
        { key: "studyNumber", header: "Study" },
        { key: "batchNumber", header: "Batch" },
        { key: "condition", header: "Condition", hideOnMobile: true },
        { key: "status", header: "Status" },
      ]}
    />
  );
}

export function InstrumentList() {
  return (
    <QcList
      title="Laboratory instruments"
      description="Instruments used on controlled tests must be active with current calibration."
      resource="instruments"
      permission="qcInstrument:read"
      createHref="/qc/instruments/new"
      createLabel="New instrument"
      exportColumns={["instrumentCode", "instrumentName", "calibrationStatus", "calibrationDueDate", "status"]}
      rowHref={(row) => `/qc/instruments/${row.id}`}
      columns={[
        { key: "instrumentCode", header: "Code" },
        { key: "instrumentName", header: "Name" },
        { key: "calibrationDueDate", header: "Cal due", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(instrumentStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function StandardList() {
  return (
    <QcList
      title="Reference standards"
      description="Expired or exhausted standards cannot be used for valid testing."
      resource="standards"
      permission="qcReferenceStandard:read"
      createHref="/qc/standards/new"
      createLabel="New standard"
      exportColumns={["standardCode", "name", "lotNumber", "expiryDate", "status"]}
      rowHref={(row) => `/qc/standards/${row.id}`}
      columns={[
        { key: "standardCode", header: "Code" },
        { key: "name", header: "Name" },
        { key: "expiryDate", header: "Expiry", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(standardStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function QcDocumentDetail({
  resource,
  id,
  permission,
  titleKey,
  statusOptions,
  actions,
  auditResource,
}: {
  resource: string;
  id: string;
  permission: Permission;
  titleKey: string;
  statusOptions: Array<{ label: string; value: string }>;
  actions: QcWorkflowAction[];
  auditResource: string;
}) {
  return (
    <RequirePermission permission={permission}>
      <DetailInner
        resource={resource}
        id={id}
        titleKey={titleKey}
        statusOptions={statusOptions}
        actions={actions}
        auditResource={auditResource}
      />
    </RequirePermission>
  );
}

function DetailInner({
  resource,
  id,
  titleKey,
  statusOptions,
  actions,
  auditResource,
}: {
  resource: string;
  id: string;
  titleKey: string;
  statusOptions: Array<{ label: string; value: string }>;
  actions: QcWorkflowAction[];
  auditResource: string;
}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [receive, setReceive] = useState({
    condition: "acceptable",
    containerIntegrity: "intact",
    quantityReceived: "",
    storageCondition: "",
    remarks: "",
    disposition: "",
  });

  function reload() {
    void getQc(resource, id)
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

  const items = (extra.items as Row[]) || [];
  const tests = (extra.tests as Row[]) || [];
  const results = (extra.results as Row[]) || [];
  const approvals = (extra.approvals as Row[]) || [];
  const timepoints = (extra.timepoints as Row[]) || [];
  const lines = (extra.lines as Array<Record<string, unknown>>) || (record.lines as Array<Record<string, unknown>>) || [];

  return (
    <div>
      <PageHeader
        title={String(record[titleKey] || id)}
        description="Controlled QC record with server-side validation and immutable audit history."
        actions={
          resource === "coas" ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/qc/coa/${id}/print`}>Print COA</Link>
            </Button>
          ) : resource === "samples" ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/qc/test-requests/new`}>Assign tests</Link>
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/qc/results`}>View results</Link>
              </Button>
            </div>
          ) : null
        }
      />
      <QcWorkflowActions
        resource={resource}
        id={id}
        status={String(record.status)}
        statusOptions={statusOptions}
        actions={actions}
        onChanged={reload}
      />
      {resource === "samples" && ["sampled", "in_transit", "planned"].includes(String(record.status)) ? (
        <div className="mb-6 rounded-xl border p-4">
          <h2 className="mb-3 text-sm font-semibold">Sample receipt</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select value={receive.condition} onValueChange={(condition) => setReceive({ ...receive, condition })}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sampleConditionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Container integrity</Label>
              <Input className="min-h-11" value={receive.containerIntegrity} onChange={(event) => setReceive({ ...receive, containerIntegrity: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Quantity received</Label>
              <Input className="min-h-11" value={receive.quantityReceived} onChange={(event) => setReceive({ ...receive, quantityReceived: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Storage condition</Label>
              <Input className="min-h-11" value={receive.storageCondition} onChange={(event) => setReceive({ ...receive, storageCondition: event.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Remarks / disposition</Label>
              <Textarea value={receive.remarks} onChange={(event) => setReceive({ ...receive, remarks: event.target.value, disposition: event.target.value })} />
            </div>
          </div>
          <Button
            className="mt-3 min-h-11"
            onClick={() => {
              void runQcAction("samples", id, "receive", {
                ...receive,
                quantityReceived: receive.quantityReceived ? Number(receive.quantityReceived) : undefined,
              })
                .then(() => {
                  toast.success("Sample receipt recorded");
                  reload();
                })
                .catch((err) => toast.error("Unable to receive sample", publicMasterError(err)));
            }}
          >
            Receive sample
          </Button>
        </div>
      ) : null}
      {resource === "samples" && String(record.status) === "received" ? (
        <div className="mb-6">
          <Button
            className="min-h-11"
            onClick={() => {
              void runQcAction("samples", id, "register")
                .then(() => {
                  toast.success("Sample registered");
                  reload();
                })
                .catch((err) => toast.error("Unable to register sample", publicMasterError(err)));
            }}
          >
            Register in laboratory
          </Button>
        </div>
      ) : null}
      {resource === "samples" ? (
        <div className="mb-6">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              const reason = window.prompt("Reason for re-sampling");
              const quantity = window.prompt("New sample quantity");
              if (!reason || !quantity) return;
              void createQc("resampling", {
                originalSampleId: id,
                reason,
                quantity: Number(quantity),
                uom: String(record.uom || "G"),
              })
                .then(() => toast.success("Re-sample created. Original sample was retained."))
                .catch((err) => toast.error("Unable to re-sample", publicMasterError(err)));
            }}
          >
            Request re-sample
          </Button>
        </div>
      ) : null}
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {Object.entries(record)
          .filter(([key]) => !["searchIndex", "nameIndex", "createdBy", "updatedBy", "id", "_updateTime", "previousValues", "newValues", "lines"].includes(key))
          .slice(0, 16)
          .map(([key, value]) => (
            <Card key={key}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground">{key}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</CardContent>
            </Card>
          ))}
      </div>
      {items.length ? (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold">Parameters</h2>
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-sm">
              {String(item.parameterName)} · {String(item.testType)} · {String(item.minimum || "")}–{String(item.maximum || "")} {String(item.unit || "")}
            </div>
          ))}
        </div>
      ) : null}
      {tests.length ? (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold">Linked tests</h2>
          {tests.map((item) => (
            <Link key={item.id} href={`/qc/tests/${item.id}`} className="block rounded-lg border p-3 text-sm hover:bg-muted/40">
              {String(item.testNumber || item.testRequestNumber || item.id)} · {String(item.status)}
            </Link>
          ))}
        </div>
      ) : null}
      {results.length ? (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold">Results</h2>
          {results.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-sm">
              {String(item.parameterName)} = {String(item.calculatedResult || item.enteredResult || "—")} · {String(item.outcome)}
            </div>
          ))}
        </div>
      ) : null}
      {lines.length ? (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold">COA lines</h2>
          {lines.map((item, index) => (
            <div key={index} className="rounded-lg border p-3 text-sm">
              {String(item.parameterName)} · {String(item.result)} · {String(item.specification)} · {String(item.outcome)}
            </div>
          ))}
        </div>
      ) : null}
      {timepoints.length ? (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold">Timepoints</h2>
          {timepoints.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-sm">
              {String(item.timepoint || item.id)} · {String(item.status || "planned")}
            </div>
          ))}
        </div>
      ) : null}
      {approvals.length ? (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold">Approvals</h2>
          {approvals.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-sm">
              Step {String(item.step)} · {String(item.role)} · {String(item.status)}
            </div>
          ))}
        </div>
      ) : null}
      <AuditHistory resource={auditResource} resourceId={id} />
    </div>
  );
}
