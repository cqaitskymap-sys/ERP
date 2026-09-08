"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { AuditHistory } from "@/components/products/audit-history";
import { QcWorkflowActions } from "@/components/qc/qc-workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createQc, getQc, runQcAction } from "@/lib/qc/client";
import { labelFor, testRequestStatusOptions, workflowTone } from "@/lib/qc/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import { useConfirm } from "@/hooks/use-confirm";

type Row = Record<string, unknown> & { id: string };

interface LineState {
  parameterId: string;
  parameterName: string;
  testType: string;
  unit: string;
  target: string;
  minimum: string;
  maximum: string;
  acceptanceCriteria: string;
  mandatory: boolean;
  testMethodId: string;
  enteredResult: string;
  remarks: string;
}

export function QcWorkbench({ id }: { id: string }) {
  return (
    <RequirePermission permission="qcTest:read">
      <WorkbenchInner id={id} />
    </RequirePermission>
  );
}

function WorkbenchInner({ id }: { id: string }) {
  const confirm = useConfirm();
  const [test, setTest] = useState<Row | null>(null);
  const [sample, setSample] = useState<Row | null>(null);
  const [request, setRequest] = useState<Row | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [results, setResults] = useState<Row[]>([]);
  const [methods, setMethods] = useState<Row[]>([]);
  const [lines, setLines] = useState<LineState[]>([]);
  const [instrumentId, setInstrumentId] = useState("");
  const [standardId, setStandardId] = useState("");
  const [attachment, setAttachment] = useState({ fileName: "", storagePath: "" });
  const [error, setError] = useState<string | null>(null);

  function reload() {
    void getQc("tests", id)
      .then((result) => {
        const extra = result.extra || {};
        setTest(result.record);
        setSample((extra.sample as Row) || null);
        setRequest((extra.request as Row) || null);
        const specItems = (extra.specItems as Row[]) || [];
        const existing = (extra.results as Row[]) || [];
        setItems(specItems);
        setResults(existing);
        setMethods((extra.methods as Row[]) || []);
        setInstrumentId(String(result.record.instrumentId || ""));
        setStandardId(String(result.record.standardId || ""));
        setLines(
          specItems.map((item) => {
            const latest = existing
              .filter((row) => String(row.parameterId) === String(item.id || item.parameterId))
              .sort((a, b) => Number(b.resultVersion || 0) - Number(a.resultVersion || 0))[0];
            return {
              parameterId: String(item.id || item.parameterId || ""),
              parameterName: String(item.parameterName || ""),
              testType: String(item.testType || "numeric"),
              unit: String(item.unit || ""),
              target: String(item.target || ""),
              minimum: String(item.minimum || ""),
              maximum: String(item.maximum || ""),
              acceptanceCriteria: String(item.acceptanceCriteria || ""),
              mandatory: item.mandatory !== false,
              testMethodId: String(item.testMethodId || ""),
              enteredResult: String(latest?.enteredResult || ""),
              remarks: String(latest?.remarks || ""),
            };
          })
        );
      })
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!test && !error) return <LoadingState />;
  if (error || !test) return <EmptyState title="Test not found" description={error || ""} />;

  const locked = ["completed", "reviewed"].includes(String(test.status));

  async function saveDraft() {
    try {
      await createQc("results", {
        testId: id,
        instrumentId,
        standardId,
        lines,
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("Draft results saved");
      reload();
    } catch (err) {
      toast.error("Unable to save results", publicMasterError(err));
    }
  }

  return (
    <div>
      <PageHeader
        title={String(test.testNumber || "Laboratory test")}
        description="Analyst workbench. Calculations and specification evaluation run on the server."
        actions={
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/qc/tests">All tests</Link>
          </Button>
        }
      />
      <QcWorkflowActions
        resource="tests"
        id={id}
        status={String(test.status)}
        statusOptions={testRequestStatusOptions}
        actions={[
          { action: "start", label: "Start testing", permission: "qcTest:execute" },
          { action: "submit", label: "Submit for review", permission: "qcTest:execute", requireReason: true },
          { action: "approve", label: "Approve", permission: "qcTest:approve", requireReason: true },
          { action: "return", label: "Return for correction", permission: "qcTest:review", requireReason: true },
          { action: "reject", label: "Reject", permission: "qcTest:review", variant: "destructive", requireReason: true },
        ]}
        onChanged={reload}
      />
      <div className="mb-6 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
        <Card>
          <CardHeader><CardTitle className="text-base">Sample</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Info label="Sample" value={sample?.sampleNumber} />
            <Info label="Batch" value={sample?.batchNumber || test.batchNumber} />
            <Info label="Product" value={sample?.productId || test.productId} />
            <Info label="Material" value={sample?.materialId || test.materialId} />
            <Info label="Vendor" value={sample?.vendorId} />
            <Info label="Goods receipt" value={sample?.goodsReceiptId} />
            <Info label="Manufacturing order" value={sample?.manufacturingOrderId} />
            <Info label="Analyst" value={test.analystId} />
            <Info label="Assigned" value={test.assignedAt} />
            <Info label="Due" value={test.dueDate || request?.dueDate} />
            <StatusBadge label={labelFor(testRequestStatusOptions, test.status)} tone={workflowTone(test.status)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Result entry</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {lines.map((line, index) => (
              <div key={line.parameterId || index} className="rounded-xl border p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{line.parameterName}</p>
                  <span className="text-xs text-muted-foreground">{line.testType}{line.mandatory ? " · mandatory" : ""}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Result</Label>
                    <Input
                      className="min-h-11"
                      disabled={locked}
                      value={line.enteredResult}
                      onChange={(event) => setLines(lines.map((row, i) => i === index ? { ...row, enteredResult: event.target.value } : row))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Remarks</Label>
                    <Input
                      className="min-h-11"
                      disabled={locked}
                      value={line.remarks}
                      onChange={(event) => setLines(lines.map((row, i) => i === index ? { ...row, remarks: event.target.value } : row))}
                    />
                  </div>
                </div>
              </div>
            ))}
            {!lines.length ? <p className="text-sm text-muted-foreground">No specification parameters are linked to this test.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Specification</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Info label="Specification" value={test.specificationId} />
            <Info label="Version" value={test.specificationVersion} />
            <Info label="Method" value={methods[0]?.methodNumber || test.testMethodId} />
            <Info label="Method version" value={methods[0]?.version} />
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border p-2">
                <p className="font-medium">{String(item.parameterName)}</p>
                <p className="text-muted-foreground">
                  {String(item.acceptanceCriteria || `${item.minimum || ""}–${item.maximum || ""}`)} {String(item.unit || "")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="mb-6 flex flex-wrap gap-2 rounded-xl border bg-card p-4">
        <div className="grid w-full gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Instrument ID</Label>
            <Input className="min-h-11" disabled={locked} value={instrumentId} onChange={(event) => setInstrumentId(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Reference standard ID</Label>
            <Input className="min-h-11" disabled={locked} value={standardId} onChange={(event) => setStandardId(event.target.value)} />
          </div>
        </div>
        <Button className="min-h-11" disabled={locked} onClick={() => void saveDraft()}>Save draft</Button>
        <Button
          className="min-h-11"
          disabled={locked}
          onClick={() => {
            void saveDraft().then(async () => {
              const accepted = await confirm({ title: "Submit result", description: "Submitted results move to QC review. This action is audited." });
              if (!accepted) return;
              const comment = window.prompt("Submission comment") || "Submitted for QC review";
              await runQcAction("tests", id, "submit", { comment });
              toast.success("Result submitted");
              reload();
            }).catch((err) => toast.error("Unable to submit", publicMasterError(err)));
          }}
        >
          Submit result
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => {
            const reason = window.prompt("Retest reason");
            if (!reason) return;
            void createQc("retests", { originalTestId: id, reason })
              .then(() => toast.success("Retest requested. Original result was retained."))
              .catch((err) => toast.error("Unable to request retest", publicMasterError(err)));
          }}
        >
          Request retest
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => {
            const parameter = window.prompt("Failed parameter");
            const observedResult = window.prompt("Observed result");
            const description = window.prompt("OOS description");
            if (!parameter || !observedResult || !description) return;
            void createQc("oos", {
              testId: id,
              testRequestId: test.testRequestId,
              sampleId: test.sampleId,
              batchNumber: test.batchNumber,
              parameter,
              observedResult,
              description,
            })
              .then(() => toast.success("OOS opened. It was not closed automatically."))
              .catch((err) => toast.error("Unable to flag OOS", publicMasterError(err)));
          }}
        >
          Flag OOS
        </Button>
        <div className="flex w-full flex-col gap-2 md:flex-row">
          <Input className="min-h-11" placeholder="Attachment file name" value={attachment.fileName} onChange={(event) => setAttachment({ ...attachment, fileName: event.target.value })} />
          <Input className="min-h-11" placeholder="qc/tests/{id}/worksheet.pdf" value={attachment.storagePath} onChange={(event) => setAttachment({ ...attachment, storagePath: event.target.value })} />
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              void runQcAction("tests", id, "document", {
                parentType: "tests",
                parentId: id,
                fileName: attachment.fileName,
                storagePath: attachment.storagePath || `qc/tests/${id}/${attachment.fileName}`,
              })
                .then(() => toast.success("Attachment registered"))
                .catch((err) => toast.error("Unable to add attachment", publicMasterError(err)));
            }}
          >
            Add attachment
          </Button>
        </div>
      </div>
      {results.length ? (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold">Result history</h2>
          {results.map((row) => (
            <div key={row.id} className="rounded-lg border p-3 text-sm">
              v{String(row.resultVersion || 1)} · {String(row.parameterName)} = {String(row.calculatedResult || row.enteredResult)} · {String(row.outcome)}
            </div>
          ))}
        </div>
      ) : null}
      <AuditHistory resource="qcTests" resourceId={id} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p>{value ? String(value) : "—"}</p>
    </div>
  );
}
