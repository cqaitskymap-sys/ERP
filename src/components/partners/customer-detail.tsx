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
import { classifyExpiry, expiryLabel } from "@/lib/partners/expiry";
import {
  customerTypeOptions,
  labelFor,
  partnerStatusOptions,
  qualificationStatusOptions,
  riskOptions,
  riskTone,
} from "@/lib/partners/catalog";

export function CustomerDetail({ id }: { id: string }) {
  return (
    <RequirePermission permission="customers:read">
      <CustomerDetailInner id={id} />
    </RequirePermission>
  );
}

function CustomerDetailInner({ id }: { id: string }) {
  const [record, setRecord] = useState<(Record<string, unknown> & { id: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState({ products: 0, contracts: 0, expiringDocs: 0 });
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  function reload() {
    void getMasterRecord("customers", id)
      .then((result) => setRecord(result.record))
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getMasterRecord("customers", id)
        .then((result) => setRecord(result.record))
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
      void Promise.all([
        listMasterRecords("productCustomerMappings", { customerId: id, status: "active", pageSize: 50 }),
        listMasterRecords("customerContracts", { customerId: id, status: "active", pageSize: 50 }),
        listMasterRecords("customerDocuments", { customerId: id, pageSize: 50 }),
      ])
        .then(([products, contracts, documents]) => {
          setCards({
            products: products.rows.length,
            contracts: contracts.rows.length,
            expiringDocs: documents.rows.filter((row) => classifyExpiry(row.expiryDate).startsWith("expir")).length,
          });
        })
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (loading) return <LoadingState />;
  if (error || !record) {
    return <EmptyState title="Customer not found" description={error || "This customer is unavailable."} />;
  }

  function setTab(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div>
      <PageHeader
        title={String(record.customerName)}
        description={`${record.customerCode || "Code pending"} · Internal products stay in Product Master.`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/masters/customers/${id}/edit`}>Edit</Link>
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Status" value={labelFor(partnerStatusOptions, record.status)} />
        <Stat label="Qualification" value={labelFor(qualificationStatusOptions, record.qualificationStatus)} />
        <Stat label="Risk" value={labelFor(riskOptions, record.riskCategory)} />
        <Stat label="Active products" value={cards.products} />
        <Stat label="Active contracts" value={cards.contracts} />
        <Stat label="Documents expiring" value={cards.expiringDocs} />
      </div>
      <WorkflowBar entity="customers" id={id} status={String(record.status || "draft")} onChanged={reload} />
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="qualification">Qualification</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="audit">Audit History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard title="Identity">
              <Info label="Code" value={record.customerCode} />
              <Info label="Legal name" value={record.legalName} />
              <Info label="Type" value={labelFor(customerTypeOptions, record.customerType)} />
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
            <InfoCard title="Primary contact">
              <Info label="Name" value={record.primaryContactName} />
              <Info label="Email" value={record.primaryContactEmail} />
              <Info label="Phone" value={record.primaryContactPhone} />
              <Info label="Account manager" value={record.accountManager} />
            </InfoCard>
          </div>
        </TabsContent>
        <TabsContent value="contacts">
          <RelatedMasterPanel entity="customerContacts" locked={{ customerId: id }} writePermission="customers:update" defaults={{ customerId: id }} />
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-semibold">Addresses</h3>
            <RelatedMasterPanel entity="customerAddresses" locked={{ customerId: id }} writePermission="customers:update" defaults={{ customerId: id }} />
          </div>
        </TabsContent>
        <TabsContent value="qualification">
          <RelatedMasterPanel entity="customerQualifications" locked={{ customerId: id }} writePermission="customers:qualify" defaults={{ customerId: id }} />
        </TabsContent>
        <TabsContent value="products">
          <RelatedMasterPanel entity="productCustomerMappings" locked={{ customerId: id }} writePermission="products:update" defaults={{ customerId: id }} />
        </TabsContent>
        <TabsContent value="contracts">
          <RelatedMasterPanel entity="customerContracts" locked={{ customerId: id }} writePermission="customers:update" defaults={{ customerId: id }} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentPanel kind="customers" parentId={id} writePermission="customers:create" />
        </TabsContent>
        <TabsContent value="risk">
          <InfoCard title="Risk classification">
            <Info
              label="Current risk"
              value={<StatusBadge label={labelFor(riskOptions, record.riskCategory)} tone={riskTone(record.riskCategory)} />}
            />
            <p className="text-xs text-muted-foreground">
              Risk is set by authorized reviewers. It is not auto-assigned. Changes are audited.
            </p>
          </InfoCard>
        </TabsContent>
        <TabsContent value="activity">
          <AuditHistory resource="customers" resourceId={id} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditHistory resource="customers" resourceId={id} />
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

export { expiryLabel };
