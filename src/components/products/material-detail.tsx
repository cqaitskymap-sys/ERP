"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/feedback/status-badge";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { RelatedMasterPanel } from "@/components/products/related-master-panel";
import { AuditHistory } from "@/components/products/audit-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMasterRecord } from "@/lib/masters/client";
import { publicMasterError } from "@/lib/masters/errors";
import { labelFor, materialStatusOptions, materialTypeOptions } from "@/lib/products/catalog";

export function MaterialDetail({ id }: { id: string }) {
  return (
    <RequirePermission permission="materials:read">
      <MaterialDetailInner id={id} />
    </RequirePermission>
  );
}

function MaterialDetailInner({ id }: { id: string }) {
  const [record, setRecord] = useState<(Record<string, unknown> & { id: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getMasterRecord("materials", id)
        .then((result) => setRecord(result.record))
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (loading) return <LoadingState />;
  if (error || !record) {
    return <EmptyState title="Material not found" description={error || "This material is unavailable."} />;
  }

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div>
      <PageHeader
        title={String(record.materialName)}
        description={`${record.materialCode} · Material master status is separate from lot quality disposition.`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/masters/materials/${id}/edit`}>Edit</Link>
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="specifications">Specifications</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="quality">Quality Configuration</TabsTrigger>
          <TabsTrigger value="audit">Audit History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Code" value={record.materialCode} />
                <Row label="Type" value={labelFor(materialTypeOptions, record.materialType)} />
                <Row label="UOM" value={record.uom} />
                <Row label="Specification" value={record.specification} />
                <Row
                  label="Status"
                  value={
                    <StatusBadge
                      label={labelFor(materialStatusOptions, record.status)}
                      tone={record.status === "active" ? "success" : "info"}
                    />
                  }
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pharmaceutical details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Generic name" value={record.genericName} />
                <Row label="Chemical name" value={record.chemicalName} />
                <Row label="CAS number" value={record.casNumber} />
                <Row label="Grade" value={record.grade} />
                <Row label="Manufacturer" value={record.manufacturer} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="suppliers">
          <RelatedMasterPanel entity="materialSupplierMappings" locked={{ materialId: id }} writePermission="materials:update" defaults={{ materialId: id }} />
        </TabsContent>
        <TabsContent value="specifications">
          <RelatedMasterPanel entity="materialSpecifications" locked={{ materialId: id }} writePermission="materials:create" defaults={{ materialId: id }} />
        </TabsContent>
        <TabsContent value="storage">
          <RelatedMasterPanel entity="materialStorageConfigurations" locked={{ materialId: id }} writePermission="materials:update" defaults={{ materialId: id }} />
        </TabsContent>
        <TabsContent value="products">
          <RelatedMasterPanel entity="productMaterials" locked={{ materialId: id }} writePermission="products:update" defaults={{ materialId: id }} />
        </TabsContent>
        <TabsContent value="quality">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lot / batch requirements</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm md:grid-cols-2">
              <Row label="Default lot quality status" value={record.defaultQualityStatus} />
              <Row label="Batch required" value={record.batchRequired ? "Yes" : "No"} />
              <Row label="Lot required" value={record.lotRequired ? "Yes" : "No"} />
              <Row label="Expiry required" value={record.expiryRequired ? "Yes" : "No"} />
              <Row label="Manufacturing date required" value={record.manufacturingDateRequired ? "Yes" : "No"} />
              <Row label="Retest date required" value={record.retestDateRequired ? "Yes" : "No"} />
              <Row label="Supplier batch required" value={record.supplierBatchRequired ? "Yes" : "No"} />
              <Row label="Manufacturer batch required" value={record.manufacturerBatchRequired ? "Yes" : "No"} />
              <p className="md:col-span-2 text-xs text-muted-foreground">
                These flags configure future inventory lots. They do not create stock or batches in this phase.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="audit">
          <AuditHistory resource="materials" resourceId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function display(value: unknown): ReactNode {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return value as ReactNode;
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{display(value)}</span>
    </div>
  );
}
