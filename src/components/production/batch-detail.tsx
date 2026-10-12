"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { AuditHistory } from "@/components/products/audit-history";
import { ProductionWorkflowActions } from "@/components/production/workflow-actions";
import { moActions } from "@/components/production/document-pages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { actOnStep, getMaterialPlan, getProduction, getProductionReadiness, runProductionAction } from "@/lib/production/client";
import { labelFor, moStatusOptions, stepStatusOptions, workflowTone } from "@/lib/production/catalog";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

type Row = Record<string, unknown> & { id: string };

export function BatchDetail({ id }: { id: string }) {
  return (
    <RequirePermission permission="manufacturingOrder:read">
      <Inner id={id} />
    </RequirePermission>
  );
}

function Inner({ id }: { id: string }) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<{ ready: boolean; blockers: string[]; warnings: string[] } | null>(null);
  const [materials, setMaterials] = useState<Array<Record<string, unknown>>>([]);
  const [userId, setUserId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");

  function reload() {
    void getProduction("orders", id)
      .then((result) => {
        setRecord(result.record);
        setExtra(result.extra || {});
      })
      .catch((err) => setError(publicMasterError(err)));
    void getProductionReadiness(id)
      .then((result) => setReadiness(result.result))
      .catch(() => setReadiness(null));
    void getMaterialPlan(id)
      .then((result) => setMaterials(((result.result.availability as Array<Record<string, unknown>>) || [])))
      .catch(() => setMaterials([]));
  }

  useEffect(() => {
    const timer = window.setTimeout(reload, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) return <EmptyState title="Batch not found" description={error || ""} />;

  const steps = (extra.steps as Row[]) || [];
  const ipc = (extra.ipc as Row[]) || [];
  const yields = (extra.yields as Row[]) || [];
  const recon = (extra.reconciliations as Row[]) || [];
  const deviations = (extra.deviations as Row[]) || [];
  const equipment = (extra.equipment as Row[]) || [];
  const operators = (extra.operators as Row[]) || [];
  const bomItems = (extra.bomItems as Row[]) || [];
  const dispensing = (extra.dispensing as Row[]) || [];
  const bmr = extra.bmr as Row | undefined;

  async function assign(kind: "user" | "equipment") {
    try {
      await runProductionAction("orders", id, "assign", kind === "user" ? { userId } : { equipmentId });
      toast.success("Assignment saved");
      reload();
    } catch (err) {
      toast.error("Unable to assign", publicMasterError(err));
    }
  }

  return (
    <div>
      <PageHeader
        title={String(record.batchNumber || record.manufacturingOrderNumber)}
        description="Controlled batch record. QC and QA statuses are integration points only."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-11"><Link href="/production/materials">Materials</Link></Button>
            <Button asChild variant="outline" className="min-h-11"><Link href="/production/records">BMR</Link></Button>
          </div>
        }
      />
      <ProductionWorkflowActions
        resource="orders"
        id={id}
        status={String(record.status)}
        statusOptions={moStatusOptions}
        actions={moActions}
        onChanged={reload}
      />
      <div className="mb-6 overflow-x-auto rounded-xl border p-4">
        <p className="mb-3 text-sm font-semibold">Batch timeline</p>
        <div className="flex min-w-[640px] items-center gap-2 text-xs">
          {["Plan", "Schedule", "BOM", "Materials", "Dispensing", "Manufacturing", "IPC", "Yield", "QC", "QA"].map((step, index) => (
            <div key={step} className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-3 py-1">{step}</span>
              {index < 9 ? <span className="text-muted-foreground">→</span> : null}
            </div>
          ))}
        </div>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex h-auto flex-wrap">
          {["overview", "planning", "bom", "materials", "dispensing", "bmr", "process", "equipment", "operators", "ipc", "yield", "reconciliation", "deviations", "qc", "qa", "documents", "audit"].map((tab) => (
            <TabsTrigger key={tab} value={tab} className="min-h-10 capitalize">{tab}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <Grid record={record} keys={["manufacturingOrderNumber", "batchNumber", "productId", "customerId", "batchSize", "uom", "status", "qcStatus", "qaStatus", "plannedStartDate", "actualStartDate", "supervisor"]} />
          {readiness ? (
            <div className="mt-4 rounded-xl border p-4">
              <p className="mb-2 text-sm font-semibold">Production readiness</p>
              <StatusBadge label={readiness.ready ? "Ready" : "Blocked"} tone={readiness.ready ? "success" : "critical"} />
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {readiness.blockers.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                {readiness.warnings.map((item, index) => <li key={`${item}-${index}`} className="text-muted-foreground">{item}</li>)}
              </ul>
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="planning">
          <Grid record={record} keys={["productionPlanId", "scheduleId", "batchPlanId", "plannedQuantity", "plannedStartDate", "plannedEndDate", "priority"]} />
        </TabsContent>
        <TabsContent value="bom">
          <p className="mb-3 text-sm text-muted-foreground">BOM version {String(record.bomVersion || "—")} is frozen on this batch.</p>
          <LineList rows={bomItems} render={(item) => `${item.materialId} · ${item.quantity} ${item.uom} · ${item.materialStage}`} />
        </TabsContent>
        <TabsContent value="materials">
          <div className="grid gap-3 md:grid-cols-2">
            {materials.map((line) => (
              <div key={String(line.materialId)} className="rounded-xl border p-4">
                <p className="font-medium">{String(line.materialId)}</p>
                <p className="text-sm">Required {String(line.requiredQuantity)} · Available {String(line.availableQuantity)}</p>
                <p className="text-sm">Quarantine {String(line.quarantineQuantity)} · Approved {String(line.approvedQuantity)} · Blocked {String(line.blockedQuantity)}</p>
                <p className="text-sm">Shortage {String(line.shortage)}</p>
                {String(line.status) === "short" ? (
                  <Button asChild variant="outline" className="mt-3 min-h-11">
                    <Link href="/procurement/requisitions/new">Procurement Required</Link>
                  </Button>
                ) : null}
              </div>
            ))}
            {!materials.length ? <p className="text-sm text-muted-foreground">No material plan yet. An effective BOM is required.</p> : null}
          </div>
        </TabsContent>
        <TabsContent value="dispensing">
          <LineList rows={dispensing} render={(item) => `${item.dispensingRequestNumber || item.id} · ${item.status}`} />
        </TabsContent>
        <TabsContent value="bmr">
          {bmr ? <Grid record={bmr} keys={["bmrNumber", "bomVersion", "processVersion", "status", "startedAt", "completedAt", "supervisor"]} /> : <p className="text-sm text-muted-foreground">No BMR issued yet.</p>}
        </TabsContent>
        <TabsContent value="process">
          <div className="space-y-2">
            {steps.map((step) => (
              <div key={step.id} className="flex flex-col gap-2 rounded-xl border p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{String(step.sequence)} · {String(step.stepName)}</p>
                  <p className="text-sm text-muted-foreground">{String(step.instructions || "")}</p>
                </div>
                <StatusBadge label={labelFor(stepStatusOptions, step.status)} tone={workflowTone(step.status)} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="min-h-11" variant="outline" onClick={() => void actOnStep(step.id, "start").then(reload).catch((err) => toast.error("Unable to start step", publicMasterError(err)))}>Start</Button>
                  <Button size="sm" className="min-h-11" variant="outline" onClick={() => void actOnStep(step.id, "complete").then(reload).catch((err) => toast.error("Unable to complete step", publicMasterError(err)))}>Complete</Button>
                </div>
              </div>
            ))}
            {!steps.length ? <p className="text-sm text-muted-foreground">Issue a BMR to create process steps.</p> : null}
          </div>
        </TabsContent>
        <TabsContent value="equipment">
          <LineList rows={equipment} render={(item) => String(item.equipmentId)} />
          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <Input className="min-h-11" placeholder="Equipment ID" value={equipmentId} onChange={(event) => setEquipmentId(event.target.value)} />
            <Button className="min-h-11" onClick={() => void assign("equipment")}>Assign equipment</Button>
          </div>
        </TabsContent>
        <TabsContent value="operators">
          <LineList rows={operators} render={(item) => `${item.userId} · ${item.role} · ${item.trainingStatus}`} />
          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <Input className="min-h-11" placeholder="Operator user ID" value={userId} onChange={(event) => setUserId(event.target.value)} />
            <Button className="min-h-11" onClick={() => void assign("user")}>Assign operator</Button>
          </div>
        </TabsContent>
        <TabsContent value="ipc">
          <LineList rows={ipc} render={(item) => `${item.parameter} · actual ${item.actual || "—"} · ${item.result}`} />
        </TabsContent>
        <TabsContent value="yield">
          <LineList rows={yields} render={(item) => `${item.yieldPercentage}% · ${item.result}`} />
        </TabsContent>
        <TabsContent value="reconciliation">
          <LineList rows={recon} render={(item) => `${item.materialId} · difference ${item.difference} · ${item.status}`} />
        </TabsContent>
        <TabsContent value="deviations">
          <LineList rows={deviations} render={(item) => `${item.deviationNumber || item.id} · ${item.severity} · ${item.status}`} />
        </TabsContent>
        <TabsContent value="qc">
          <p className="text-sm">QC status: <strong>{String(record.qcStatus || "not_started")}</strong></p>
          <p className="mt-2 text-sm text-muted-foreground">QC laboratory testing is a future phase. This status is an integration point only. No test results are created here.</p>
        </TabsContent>
        <TabsContent value="qa">
          <p className="text-sm">QA status: <strong>{String(record.qaStatus || "not_started")}</strong></p>
          <p className="mt-2 text-sm text-muted-foreground">QA batch release is a future phase. Completion sends the batch to QC Pending, not Released.</p>
        </TabsContent>
        <TabsContent value="documents">
          <p className="text-sm text-muted-foreground">Controlled documents attach through the existing document architecture. Historical BMR and BOM versions stay referenced by ID.</p>
        </TabsContent>
        <TabsContent value="audit">
          <AuditHistory resource={PRODUCTION_COLLECTIONS.orders} resourceId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Grid({ record, keys }: { record: Record<string, unknown>; keys: string[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {keys.map((key) => (
        <div key={key} className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">{key}</p>
          <p className="mt-1 text-sm">{String(record[key] ?? "—")}</p>
        </div>
      ))}
    </div>
  );
}

function LineList({ rows, render }: { rows: Row[]; render: (row: Row) => string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">No records yet.</p>;
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border p-3 text-sm">{render(row)}</div>
      ))}
    </div>
  );
}
