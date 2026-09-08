"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { AuditHistory } from "@/components/products/audit-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWarehouse, saveInventoryDocument } from "@/lib/inventory/client";
import { inventoryDocumentTypeOptions, labelFor, ledgerTypeOptions, qualityStatusOptions, qualityTone } from "@/lib/inventory/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { uploadFile } from "@/lib/services/storage-service";
import { toast } from "@/lib/feedback/toast";

export function BatchDetail({ id }: { id: string }) {
  return (
    <RequirePermission permission="inventory:read">
      <Inner id={id} />
    </RequirePermission>
  );
}

function Inner({ id }: { id: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    void getWarehouse("batches", id)
      .then((result) => setData({ record: result.record, ...(result.extra || {}) }))
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getWarehouse("batches", id)
        .then((result) => setData({ record: result.record, ...(result.extra || {}) }))
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (!data && !error) return <LoadingState />;
  if (error || !data) return <EmptyState title="Batch not found" description={error || ""} />;
  const batch = data.record as Record<string, unknown>;
  const balances = (data.balances as Array<Record<string, unknown>>) || [];
  const ledger = (data.ledger as Array<Record<string, unknown>>) || [];
  const events = (data.events as Array<Record<string, unknown>>) || [];
  const documents = (data.documents as Array<Record<string, unknown>>) || [];

  return (
    <div>
      <PageHeader
        title={`Batch ${batch.batchNumber}`}
        description={`${batch.itemCode} · ${batch.itemName}`}
        actions={
          <Button asChild variant="outline" className="min-h-11">
            <Link href={`/warehouse/traceability?batchNumber=${String(batch.batchNumber)}`}>Full traceability</Link>
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {["Received", "Quarantine", "Testing", "Released", "Issued", "Returned/Consumed"].map((step) => (
          <StatusBadge key={step} label={step} tone={timelineTone(step, events)} />
        ))}
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="trace">Traceability</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="audit">Audit history</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Fact label="Supplier batch" value={String(batch.supplierBatchNumber || "—")} />
            <Fact label="Manufacturer batch" value={String(batch.manufacturerBatchNumber || "—")} />
            <Fact label="Manufacturing date" value={String(batch.manufacturingDate || "—")} />
            <Fact label="Expiry" value={String(batch.expiryDate || "—")} />
            <Fact label="Retest" value={String(batch.retestDate || "—")} />
            <Fact label="Quantity" value={`${batch.availableQuantity} ${batch.uom || ""}`} />
            <Fact label="Warehouse" value={String(batch.warehouseId)} />
            <Fact label="Location" value={String(batch.locationId)} />
            <Fact
              label="Quality"
              value={<StatusBadge label={labelFor(qualityStatusOptions, batch.qualityStatus)} tone={qualityTone(batch.qualityStatus)} />}
            />
          </div>
        </TabsContent>
        <TabsContent value="stock">
          <CardList
            rows={balances}
            render={(row) =>
              `${row.warehouseId} / ${row.locationId} · ${row.qualityStatus} · ${row.availableQuantity} ${row.uom || ""}`
            }
          />
        </TabsContent>
        <TabsContent value="transactions">
          <CardList
            rows={ledger}
            render={(row) =>
              `${row.performedAt} · ${labelFor(ledgerTypeOptions, row.transactionType)} · in ${row.quantityIn} / out ${row.quantityOut}`
            }
          />
        </TabsContent>
        <TabsContent value="quality">
          <p className="mb-2 text-sm text-muted-foreground">
            QC status: {String(batch.qcStatus || "pending")} · QA status: {String(batch.qaStatus || "pending")}
          </p>
          <CardList
            rows={(data.history as Array<Record<string, unknown>>) || []}
            render={(row) => `${row.previousStatus || "—"} → ${row.newStatus} · ${row.reason || ""}`}
          />
        </TabsContent>
        <TabsContent value="trace">
          <CardList rows={events} render={(row) => `${row.performedAt} · ${row.title} · ${row.detail || ""}`} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentUpload batchId={id} onUploaded={reload} />
          <CardList rows={documents} render={(row) => `${row.documentType} · ${row.title}`} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditHistory resource="inventoryBatches" resourceId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function timelineTone(step: string, events: Array<Record<string, unknown>>) {
  const types = events.map((event) => String(event.eventType));
  if (step === "Received" && types.includes("RECEIPT")) return "success" as const;
  if (step === "Quarantine" && types.includes("RECEIPT")) return "warning" as const;
  if (step === "Testing" && types.includes("RELEASE") === false && types.length) return "info" as const;
  if (step === "Released" && types.includes("RELEASE")) return "success" as const;
  if (step === "Issued" && types.includes("ISSUE")) return "info" as const;
  if (step === "Returned/Consumed" && (types.includes("RETURN") || types.includes("CONSUMPTION"))) return "info" as const;
  return "neutral" as const;
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm font-medium">{value}</CardContent>
    </Card>
  );
}

function CardList({
  rows,
  render,
}: {
  rows: Array<Record<string, unknown>>;
  render: (row: Record<string, unknown>) => string;
}) {
  if (!rows.length) return <EmptyState title="No records" description="Events will appear after warehouse postings." />;
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={String(row.id || index)} className="rounded-lg border p-3 text-sm">
          {render(row)}
        </div>
      ))}
    </div>
  );
}

function DocumentUpload({ batchId, onUploaded }: { batchId: string; onUploaded: () => void }) {
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("coa");
  const [file, setFile] = useState<File | null>(null);

  async function upload() {
    if (!file || !title.trim()) {
      toast.error("Document title and file are required");
      return;
    }
    try {
      const documentId = crypto.randomUUID();
      const storagePath = `inventory/${batchId}/documents/${documentId}/${file.name}`;
      await uploadFile(storagePath, file, { contentType: file.type });
      await saveInventoryDocument({
        inventoryBatchId: batchId,
        documentType,
        title,
        storagePath,
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      });
      toast.success("Document uploaded");
      onUploaded();
    } catch (error) {
      toast.error("Upload failed", publicMasterError(error));
    }
  }

  return (
    <div className="mb-4 grid gap-3 rounded-xl border p-4 md:grid-cols-3">
      <div className="space-y-1.5">
        <Label>Title</Label>
        <Input className="min-h-11" value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={documentType} onValueChange={setDocumentType}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {inventoryDocumentTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>File</Label>
        <Input className="min-h-11" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      </div>
      <Button className="min-h-11 md:col-span-3" onClick={() => void upload()}>
        Upload document
      </Button>
    </div>
  );
}
