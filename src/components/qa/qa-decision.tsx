"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/hooks/use-confirm";
import { createQa, getQa, runQaAction } from "@/lib/qa/client";
import {
  checklistStatusOptions,
  holdReasonOptions,
  labelFor,
  qaReviewStatusOptions,
  rejectionCategoryOptions,
  workflowTone,
} from "@/lib/qa/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

type Row = Record<string, unknown> & { id: string };

export function QaDecisionPage({ id }: { id: string }) {
  return (
    <RequirePermission permission="qaBatchReview:read">
      <DecisionInner id={id} />
    </RequirePermission>
  );
}

function DecisionInner({ id }: { id: string }) {
  const { can } = useAuth();
  const confirm = useConfirm();
  const router = useRouter();
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState({
    reason: "",
    comments: "",
    holdReason: "investigation_pending",
    rejectionCategory: "quality_failure",
  });

  function reload() {
    void getQa("reviews", id)
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
  if (error || !record) return <EmptyState title="QA review not found" description={error || ""} />;

  const items = ((extra.items as Row[]) || []).slice().sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
  const documents = (extra.documents as Row[]) || [];
  const certificates = (extra.certificates as Row[]) || [];
  const dossier = (extra.dossier || {}) as Record<string, unknown>;
  const validation = (extra.validation || { eligible: false, blockers: [], warnings: [] }) as {
    eligible: boolean;
    blockers: string[];
    warnings: string[];
  };
  const order = (dossier.order || {}) as Row;
  const bmr = (dossier.bmr || {}) as Row;
  const tests = (dossier.tests as Row[]) || [];
  const samples = (dossier.samples as Row[]) || [];
  const oos = (dossier.oos as Row[]) || [];
  const oot = (dossier.oot as Row[]) || [];
  const coas = (dossier.coas as Row[]) || [];
  const steps = (dossier.steps as Row[]) || [];
  const dispensing = (dossier.dispensing as Row[]) || [];
  const ipc = (dossier.ipc as Row[]) || [];
  const yields = (dossier.yields as Row[]) || [];
  const reconciliations = (dossier.reconciliations as Row[]) || [];
  const equipment = (dossier.equipment as Row[]) || [];
  const operators = (dossier.operators as Row[]) || [];
  const bomItems = (dossier.bomItems as Row[]) || [];
  const deviations = [...((dossier.productionDeviations as Row[]) || []), ...((dossier.deviations as Row[]) || [])];
  const customerRequirements = (dossier.customerRequirements as Row[]) || [];
  const status = String(record.status);

  async function act(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      await runQaAction("reviews", id, action, payload);
      toast.success("QA action recorded");
      reload();
    } catch (err) {
      toast.error("Unable to complete QA action", publicMasterError(err));
    } finally {
      setBusy(false);
    }
  }

  async function decide(next: "release" | "hold" | "reject") {
    if (!decision.reason.trim()) {
      toast.error("A reason is required");
      return;
    }
    const accepted = await confirm({
      title: next === "release" ? "Release batch" : next === "hold" ? "Hold batch" : "Reject batch",
      description:
        "This applies your electronic signature (user, role, timestamp, action, and reason). Passwords are never stored as signatures. Inventory quantities are updated only through the inventory transaction service.",
      confirmLabel: next === "release" ? "Confirm release" : next === "hold" ? "Confirm hold" : "Confirm rejection",
    });
    if (!accepted) return;
    await act(next, {
      reason: decision.reason,
      comments: decision.comments,
      holdReason: next === "hold" ? decision.holdReason : undefined,
      rejectionCategory: next === "reject" ? decision.rejectionCategory : undefined,
      idempotencyKey: `qa-${next}-${id}`,
    });
  }

  return (
    <div>
      <PageHeader
        title={String(record.reviewNumber || record.batchNumber || id)}
        description="QA is the final disposition authority. QC results and BMR records are read-only here."
        actions={
          <div className="flex flex-wrap gap-2">
            {can("qaBatchReview:update") && status === "pending_review" ? (
              <Button className="min-h-11" disabled={busy} onClick={() => void act("start")}>Start review</Button>
            ) : null}
            {can("qaBatchReview:approve") && status === "under_review" ? (
              <Button className="min-h-11" disabled={busy} variant="outline" onClick={() => void act("complete")}>
                Complete review
              </Button>
            ) : null}
            {status === "released" && can("qaReleaseCertificate:create") ? (
              <Button
                className="min-h-11"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void createQa("certificates", { reviewId: id })
                    .then((result) => {
                      toast.success("Release certificate generated");
                      router.push(`/qa/certificates/${result.id}/print`);
                    })
                    .catch((err) => toast.error("Unable to generate certificate", publicMasterError(err)));
                }}
              >
                Release certificate
              </Button>
            ) : null}
            {certificates[0] ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/qa/certificates/${certificates[0].id}/print`}>Print certificate</Link>
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge label={labelFor(qaReviewStatusOptions, status)} tone={workflowTone(status)} />
        <span className="text-sm text-muted-foreground">Batch {String(record.batchNumber || "—")}</span>
      </div>
      <QaTimeline record={record} order={order} coas={coas} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(280px,0.8fr)]">
        <Card className="min-w-0">
          <CardHeader><CardTitle className="text-base">Batch dossier</CardTitle></CardHeader>
          <CardContent>
            <DossierTabs
              record={record}
              order={order}
              bmr={bmr}
              bomItems={bomItems}
              dispensing={dispensing}
              steps={steps}
              equipment={equipment}
              operators={operators}
              ipc={ipc}
              yields={yields}
              reconciliations={reconciliations}
              deviations={deviations}
              samples={samples}
              tests={tests}
              oos={oos}
              oot={oot}
              coas={coas}
              documents={documents}
              customerRequirements={customerRequirements}
            />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader><CardTitle className="text-base">Review checklist</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {items.length ? items.map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{String(item.item)}</p>
                  {item.mandatory !== false ? <span className="text-xs text-muted-foreground">Required</span> : null}
                </div>
                <Select
                  value={String(item.status || "pending")}
                  disabled={!can("qaBatchReview:update") || ["released", "rejected", "closed"].includes(status)}
                  onValueChange={(next) => {
                    void act("checklist", { itemId: item.id, status: next, comment: item.comment });
                  }}
                >
                  <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {checklistStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="mt-2 min-h-11"
                  placeholder="Comment / evidence"
                  defaultValue={String(item.comment || "")}
                  disabled={!can("qaBatchReview:update") || ["released", "rejected", "closed"].includes(status)}
                  onBlur={(event) => {
                    if (event.target.value !== String(item.comment || "")) {
                      void act("checklist", { itemId: item.id, status: item.status, comment: event.target.value });
                    }
                  }}
                />
              </div>
            )) : <p className="text-sm text-muted-foreground">Checklist items will appear after the review is created.</p>}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader><CardTitle className="text-base">Release validation</CardTitle></CardHeader>
          <CardContent>
            <BlockerPanel validation={validation} />
          </CardContent>
        </Card>
      </div>
      {["released", "rejected", "closed"].includes(status) ? (
        <p className="mt-6 text-sm text-muted-foreground">This QA decision is locked. Corrections must be made through a new controlled record.</p>
      ) : (
        <div className="mt-6 rounded-xl border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">QA decision</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Electronic signature captures user, role, timestamp, action, and reason. Passwords are never stored.
          </p>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Reason</Label>
              <Textarea value={decision.reason} onChange={(event) => setDecision({ ...decision, reason: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Hold reason</Label>
              <Select value={decision.holdReason} onValueChange={(holdReason) => setDecision({ ...decision, holdReason })}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {holdReasonOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Rejection category</Label>
              <Select value={decision.rejectionCategory} onValueChange={(rejectionCategory) => setDecision({ ...decision, rejectionCategory })}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rejectionCategoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Comments</Label>
              <Textarea value={decision.comments} onChange={(event) => setDecision({ ...decision, comments: event.target.value })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {can("qaBatchRelease:approve") ? (
              <Button className="min-h-11" disabled={busy || !validation.eligible} onClick={() => void decide("release")}>
                Release
              </Button>
            ) : null}
            {can("qaBatchHold:approve") || can("qaBatchHold:create") ? (
              <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => void decide("hold")}>
                Hold
              </Button>
            ) : null}
            {can("qaBatchReject:approve") || can("qaBatchReject:create") ? (
              <Button className="min-h-11" variant="destructive" disabled={busy} onClick={() => void decide("reject")}>
                Reject
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function BlockerPanel({ validation }: { validation: { eligible: boolean; blockers: string[]; warnings: string[] } }) {
  return (
    <div className="space-y-3 text-sm">
      {validation.eligible ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          ✓ Batch eligible for QA disposition
        </p>
      ) : (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          Release is blocked until the items below are resolved.
        </p>
      )}
      {validation.blockers.map((item) => (
        <p key={item} className="rounded-lg border p-3">❌ {item}</p>
      ))}
      {validation.warnings.map((item) => (
        <p key={item} className="rounded-lg border p-3 text-muted-foreground">⚠ {item}</p>
      ))}
    </div>
  );
}

function QaTimeline({ record, order, coas }: { record: Row; order: Row; coas: Row[] }) {
  const steps = [
    { label: "Batch created", at: order.createdAt, user: order.createdBy, status: order.id ? "done" : "pending" },
    { label: "Manufacturing completed", at: order.completedAt || order.actualEndDate, user: order.completedBy, status: order.status },
    { label: "QC requested", at: order.qcRequestedAt, user: "", status: order.qcStatus },
    { label: "QC completed", at: record.qcCompletedAt, user: "", status: record.qcCompletedAt ? "completed" : "pending" },
    { label: "COA generated", at: coas[0]?.createdAt, user: coas[0]?.createdBy, status: coas[0]?.status },
    { label: "QA review started", at: record.startedAt, user: record.startedBy, status: record.status },
    { label: "Documentation review", at: record.completedAt, user: record.completedBy, status: record.status },
    { label: "QA decision", at: record.decidedAt, user: record.decidedBy, status: record.decision || record.status },
  ];
  return (
    <ol className="mb-6 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {steps.map((step) => (
        <li key={step.label} className="rounded-xl border bg-card p-3 text-sm">
          <p className="font-medium">{step.label}</p>
          <p className="text-muted-foreground">{step.at ? String(step.at).slice(0, 19).replace("T", " ") : "—"}</p>
          <p className="text-xs text-muted-foreground">{step.user ? String(step.user) : "Awaiting"}</p>
        </li>
      ))}
    </ol>
  );
}

function DossierTabs({
  record,
  order,
  bmr,
  bomItems,
  dispensing,
  steps,
  equipment,
  operators,
  ipc,
  yields,
  reconciliations,
  deviations,
  samples,
  tests,
  oos,
  oot,
  coas,
  documents,
  customerRequirements,
}: {
  record: Row;
  order: Row;
  bmr: Row;
  bomItems: Row[];
  dispensing: Row[];
  steps: Row[];
  equipment: Row[];
  operators: Row[];
  ipc: Row[];
  yields: Row[];
  reconciliations: Row[];
  deviations: Row[];
  samples: Row[];
  tests: Row[];
  oos: Row[];
  oot: Row[];
  coas: Row[];
  documents: Row[];
  customerRequirements: Row[];
}) {
  return (
    <Tabs defaultValue="overview">
      <TabsList className="mb-3 flex h-auto flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="bmr">BMR</TabsTrigger>
        <TabsTrigger value="materials">Materials</TabsTrigger>
        <TabsTrigger value="qc">QC / COA</TabsTrigger>
        <TabsTrigger value="deviations">Deviations</TabsTrigger>
        <TabsTrigger value="customer">Customer</TabsTrigger>
        <TabsTrigger value="docs">Documents</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="space-y-2 text-sm">
        <Fact label="Product" value={record.productId} />
        <Fact label="Customer" value={record.customerId} />
        <Fact label="Manufacturing order" value={order.orderNumber || order.id} />
        <Fact label="Batch" value={record.batchNumber} />
        <Fact label="Plant" value={record.plantId} />
        <Fact label="BOM" value={order.bomId || bmr.bomId} />
        <Fact label="Order status" value={order.status} />
        <Fact label="QA status" value={record.status} />
      </TabsContent>
      <TabsContent value="bmr" className="space-y-2 text-sm">
        <Fact label="BMR number" value={bmr.bmrNumber || bmr.id} />
        <Fact label="BMR status" value={bmr.status} />
        <Fact label="Process version" value={bmr.processVersion || bmr.version} />
        <ListBlock title="Process steps" rows={steps} render={(row) => `${row.stepName || row.stepNumber || row.id} · ${row.status || ""}`} />
        <ListBlock title="Equipment" rows={equipment} render={(row) => `${row.equipmentId || row.id} · ${row.status || ""}`} />
        <ListBlock title="Operators" rows={operators} render={(row) => `${row.operatorId || row.userId || row.id}`} />
        <ListBlock title="IPC" rows={ipc} render={(row) => `${row.checkName || row.id} · ${row.result || row.status || ""}`} />
        <ListBlock title="Yield" rows={yields} render={(row) => `${row.yieldPercent || row.actualYield || "—"} · ${row.status || ""}`} />
        <ListBlock title="Reconciliation" rows={reconciliations} render={(row) => `${row.materialId || row.id} · ${row.status || ""}`} />
      </TabsContent>
      <TabsContent value="materials" className="space-y-2 text-sm">
        <ListBlock title="BOM items" rows={bomItems} render={(row) => `${row.materialId || row.id} · ${row.quantity || ""} ${row.uom || ""}`} />
        <ListBlock title="Dispensing" rows={dispensing} render={(row) => `${row.materialId || row.id} · ${row.batchNumber || ""} · ${row.status || ""}`} />
      </TabsContent>
      <TabsContent value="qc" className="space-y-2 text-sm">
        <ListBlock title="Samples" rows={samples} render={(row) => `${row.sampleNumber || row.id} · ${row.status || ""}`} />
        <ListBlock title="Tests" rows={tests} render={(row) => `${row.testNumber || row.id} · ${row.overallResult || row.status || ""}`} />
        <ListBlock title="OOS" rows={oos} render={(row) => `${row.oosNumber || row.id} · ${row.status || ""}`} />
        <ListBlock title="OOT" rows={oot} render={(row) => `${row.ootNumber || row.id} · ${row.status || ""}`} />
        {coas.map((coa) => (
          <div key={coa.id} className="rounded-lg border p-3">
            <p className="font-medium">COA {String(coa.coaNumber || coa.id)}</p>
            <p>Status {String(coa.status || "—")} · Version {String(coa.version || 1)}</p>
            <p>Conclusion {String(coa.conclusion || "—")}</p>
            <p className="text-muted-foreground">QA cannot edit QC results. Return the test to the controlled QC workflow if a correction is required.</p>
            <Link className="mt-2 inline-block underline" href={`/qc/coa/${coa.id}`}>Open COA</Link>
          </div>
        ))}
      </TabsContent>
      <TabsContent value="deviations" className="space-y-2 text-sm">
        <ListBlock title="Deviations" rows={deviations} render={(row) => `${row.deviationNumber || row.id} · ${row.severity || ""} · ${row.status || ""}`} />
      </TabsContent>
      <TabsContent value="customer" className="space-y-2 text-sm">
        {customerRequirements.length ? customerRequirements.map((row) => (
          <div key={row.id} className="rounded-lg border p-3">
            <Fact label="Customer" value={row.customerId} />
            <Fact label="Product" value={row.productId} />
            <Fact label="Customer specification" value={row.customerSpecification || row.specificationId} />
            <Fact label="Required tests" value={row.requiredTests} />
            <Fact label="Packaging requirements" value={row.packagingRequirements} />
            <Fact label="Documentation requirements" value={row.documentationRequirements} />
            <Fact label="COA requirements" value={row.coaRequirements} />
            <Fact label="Special instructions" value={row.specialInstructions} />
          </div>
        )) : <p className="text-muted-foreground">No customer-product mapping is linked. Customer master is not duplicated here.</p>}
      </TabsContent>
      <TabsContent value="docs" className="space-y-2 text-sm">
        <ListBlock title="QA documents" rows={documents} render={(row) => `${row.documentNumber || row.title || row.id} · ${row.status || ""}`} />
      </TabsContent>
    </Tabs>
  );
}

function Fact({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex justify-between gap-3 border-b py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value ? String(value) : "—"}</span>
    </div>
  );
}

function ListBlock({ title, rows, render }: { title: string; rows: Row[]; render: (row: Row) => string }) {
  return (
    <div>
      <p className="mb-1 font-medium">{title}</p>
      {rows.length ? rows.map((row) => (
        <p key={row.id} className="rounded-md border px-2 py-1">{render(row)}</p>
      )) : <p className="text-muted-foreground">None posted.</p>}
    </div>
  );
}
