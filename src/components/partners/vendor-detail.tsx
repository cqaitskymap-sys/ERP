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
import { WorkflowBar } from "@/components/partners/workflow-bar";
import { DocumentPanel } from "@/components/partners/document-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMasterRecord, listMasterRecords } from "@/lib/masters/client";
import { publicMasterError } from "@/lib/masters/errors";
import { classifyExpiry } from "@/lib/partners/expiry";
import {
  labelFor,
  partnerStatusOptions,
  qualificationStatusOptions,
  riskOptions,
  riskTone,
  vendorTypeOptions,
} from "@/lib/partners/catalog";

export function VendorDetail({ id }: { id: string }) {
  return (
    <RequirePermission permission="vendors:read">
      <VendorDetailInner id={id} />
    </RequirePermission>
  );
}

function VendorDetailInner({ id }: { id: string }) {
  const [record, setRecord] = useState<(Record<string, unknown> & { id: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState({ materials: 0, expiringDocs: 0, performance: "—" });
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  function reload() {
    void getMasterRecord("vendors", id)
      .then((result) => setRecord(result.record))
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getMasterRecord("vendors", id)
        .then((result) => setRecord(result.record))
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
      void Promise.all([
        listMasterRecords("vendorMaterials", { vendorId: id, status: "active", pageSize: 50 }),
        listMasterRecords("vendorDocuments", { vendorId: id, pageSize: 50 }),
        listMasterRecords("vendorPerformance", { vendorId: id, pageSize: 5 }),
      ])
        .then(([materials, documents, performance]) => {
          setCards({
            materials: materials.rows.length,
            expiringDocs: documents.rows.filter((row) => classifyExpiry(row.expiryDate).startsWith("expir")).length,
            performance: String(performance.rows[0]?.overallScore ?? "—"),
          });
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (loading) return <LoadingState />;
  if (error || !record) {
    return <EmptyState title="Vendor not found" description={error || "This vendor is unavailable."} />;
  }

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div>
      <PageHeader
        title={String(record.vendorName)}
        description={`${record.vendorCode || "Code pending"} · Material master is not duplicated.`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/masters/vendors/${id}/edit`}>Edit</Link>
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Status" value={labelFor(partnerStatusOptions, record.status)} />
        <Stat label="Qualification" value={labelFor(qualificationStatusOptions, record.qualificationStatus)} />
        <Stat label="Risk" value={labelFor(riskOptions, record.riskCategory)} />
        <Stat label="Approved materials" value={cards.materials} />
        <Stat label="Documents expiring" value={cards.expiringDocs} />
        <Stat label="Performance rating" value={cards.performance} />
      </div>
      <WorkflowBar entity="vendors" id={id} status={String(record.status || "draft")} onChanged={reload} />
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="qualification">Qualification</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="audit">Audit History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard title="Identity">
              <Info label="Code" value={record.vendorCode} />
              <Info label="Type" value={labelFor(vendorTypeOptions, record.vendorType)} />
              <Info label="Country" value={record.country} />
              <Info
                label="Status"
                value={
                  <StatusBadge
                    label={labelFor(partnerStatusOptions, record.status)}
                    tone={record.status === "active" ? "success" : "info"}
                  />
                }
              />
            </InfoCard>
            <InfoCard title="Roles">
              <Info label="Manufacturer" value={record.manufacturer ? "Yes" : "No"} />
              <Info label="Distributor" value={record.distributor ? "Yes" : "No"} />
              <Info label="Supplier" value={record.supplier ? "Yes" : "No"} />
              <Info label="Service provider" value={record.serviceProvider ? "Yes" : "No"} />
            </InfoCard>
          </div>
        </TabsContent>
        <TabsContent value="materials">
          <RelatedMasterPanel entity="vendorMaterials" locked={{ vendorId: id }} writePermission="vendors:update" defaults={{ vendorId: id }} />
        </TabsContent>
        <TabsContent value="qualification">
          <RelatedMasterPanel entity="vendorQualifications" locked={{ vendorId: id }} writePermission="vendors:qualify" defaults={{ vendorId: id }} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentPanel kind="vendors" parentId={id} writePermission="vendors:create" />
        </TabsContent>
        <TabsContent value="performance">
          <RelatedMasterPanel entity="vendorPerformance" locked={{ vendorId: id }} writePermission="vendors:create" defaults={{ vendorId: id }} />
        </TabsContent>
        <TabsContent value="risk">
          <InfoCard title="Risk classification">
            <Info
              label="Current risk"
              value={<StatusBadge label={labelFor(riskOptions, record.riskCategory)} tone={riskTone(record.riskCategory)} />}
            />
            <p className="text-xs text-muted-foreground">
              Risk is a reviewer decision. Automatic scoring from delivery or QC history is not implemented in this phase.
            </p>
          </InfoCard>
        </TabsContent>
        <TabsContent value="contracts">
          <RelatedMasterPanel entity="vendorContracts" locked={{ vendorId: id }} writePermission="vendors:update" defaults={{ vendorId: id }} />
        </TabsContent>
        <TabsContent value="activity">
          <AuditHistory resource="vendors" resourceId={id} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditHistory resource="vendors" resourceId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-semibold">{value || "—"}</p>
      </CardContent>
    </Card>
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
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
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
