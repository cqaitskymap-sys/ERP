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
import { labelFor, productStatusOptions, productTypeOptions } from "@/lib/products/catalog";
import { useMasterList } from "@/hooks/use-masters";
import { FormSelect } from "@/components/forms/form-select";

export function ProductDetail({ id }: { id: string }) {
  return (
    <RequirePermission permission="products:read">
      <ProductDetailInner id={id} />
    </RequirePermission>
  );
}

function ProductDetailInner({ id }: { id: string }) {
  const [record, setRecord] = useState<(Record<string, unknown> & { id: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getMasterRecord("products", id)
        .then((result) => setRecord(result.record))
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (loading) return <LoadingState />;
  if (error || !record) {
    return <EmptyState title="Product not found" description={error || "This product is unavailable."} />;
  }

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div>
      <PageHeader
        title={String(record.productName)}
        description={`${record.productCode} · Internal product. Customer names live on the Customers tab.`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/masters/products/${id}/edit`}>Edit</Link>
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="packaging">Packaging</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="formula">Formula</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="regulatory">Regulatory</TabsTrigger>
          <TabsTrigger value="audit">Audit History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard title="Identity">
              <Info label="Code" value={record.productCode} />
              <Info label="Generic name" value={record.genericName} />
              <Info label="Brand name" value={record.brandName} />
              <Info label="Type" value={labelFor(productTypeOptions, record.productType)} />
              <Info
                label="Status"
                value={
                  <StatusBadge
                    label={labelFor(productStatusOptions, record.status)}
                    tone={record.status === "active" ? "success" : "info"}
                  />
                }
              />
            </InfoCard>
            <InfoCard title="Pharmaceutical">
              <Info label="Dosage form" value={record.dosageForm} />
              <Info label="Strength" value={`${record.strength || "—"} ${record.strengthUnit || ""}`} />
              <Info label="Route" value={record.routeOfAdministration} />
              <Info label="Therapeutic category" value={record.therapeuticCategory} />
              <Info label="QA responsible" value={record.qaResponsible} />
            </InfoCard>
            <InfoCard title="Shelf life configuration">
              <Info label="Shelf life" value={`${record.shelfLifeValue || "—"} ${record.shelfLifeUnit || ""}`} />
              <Info label="Retest period" value={`${record.retestPeriodValue || "—"} ${record.retestPeriodUnit || ""}`} />
              <Info label="Expiry rule" value={record.expiryCalculationRule} />
              <p className="text-xs text-muted-foreground">
                Future batch records can calculate expiry from this configuration. Batches are not generated here.
              </p>
            </InfoCard>
            <InfoCard title="Storage">
              <Info label="Condition" value={record.storageCondition} />
              <Info label="Manufacturing site" value={record.manufacturingSiteId} />
              <Info label="Product owner" value={record.productOwner} />
            </InfoCard>
          </div>
        </TabsContent>
        <TabsContent value="versions">
          <RelatedMasterPanel entity="productVersions" locked={{ productId: id }} writePermission="products:create" defaults={{ productId: id }} />
        </TabsContent>
        <TabsContent value="customers">
          <RelatedMasterPanel entity="productCustomerMappings" locked={{ productId: id }} writePermission="products:update" defaults={{ productId: id }} />
        </TabsContent>
        <TabsContent value="packaging">
          <RelatedMasterPanel entity="productPackaging" locked={{ productId: id }} writePermission="products:update" defaults={{ productId: id }} />
        </TabsContent>
        <TabsContent value="storage">
          <RelatedMasterPanel entity="productStorageConfigurations" locked={{ productId: id }} writePermission="products:update" defaults={{ productId: id }} />
        </TabsContent>
        <TabsContent value="formula">
          <RelatedMasterPanel entity="productFormulas" locked={{ productId: id }} writePermission="products:create" defaults={{ productId: id }} />
          <FormulaLinesSection productId={id} />
        </TabsContent>
        <TabsContent value="materials">
          <RelatedMasterPanel entity="productMaterials" locked={{ productId: id }} writePermission="products:update" defaults={{ productId: id }} />
        </TabsContent>
        <TabsContent value="regulatory">
          <RelatedMasterPanel entity="productRegulatoryInformation" locked={{ productId: id }} writePermission="products:update" defaults={{ productId: id }} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditHistory resource="products" resourceId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FormulaLinesSection({ productId }: { productId: string }) {
  const { rows: formulas, loading } = useMasterList("productFormulas", {
    productId,
    pageSize: 50,
  });
  const [formulaId, setFormulaId] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!formulaId && formulas[0]) setFormulaId(formulas[0].id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [formulaId, formulas]);

  return (
    <div className="mt-6 space-y-4">
      <div className="max-w-sm">
        <FormSelect
          label="Formula lines for"
          value={formulaId || undefined}
          placeholder={loading ? "Loading formulas..." : "Select a formula"}
          options={formulas.map((formula) => ({
            value: formula.id,
            label: String(formula.formulaVersion || formula.id),
          }))}
          onChange={setFormulaId}
        />
      </div>
      {formulaId ? (
        <RelatedMasterPanel
          entity="productFormulaLines"
          locked={{ formulaId }}
          writePermission="products:create"
          defaults={{ formulaId }}
        />
      ) : (
        <EmptyState
          title="Select a formula"
          description="Create a formula header first, then add material lines to that version."
        />
      )}
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function display(value: unknown): ReactNode {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return value as ReactNode;
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{display(value)}</span>
    </div>
  );
}
