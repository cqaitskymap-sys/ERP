"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { AuditHistory } from "@/components/products/audit-history";
import { ProcurementList } from "@/components/procurement/procurement-list";
import { ProcurementWorkflowActions, type ProcurementWorkflowAction } from "@/components/procurement/workflow-actions";
import { SelectionReasonField } from "@/components/procurement/forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getProcurement, createProcurement } from "@/lib/procurement/client";
import {
  amendmentStatusOptions,
  labelFor,
  poStatusOptions,
  prStatusOptions,
  quotationStatusOptions,
  rfqStatusOptions,
  workflowTone,
} from "@/lib/procurement/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

type Row = Record<string, unknown> & { id: string };

export function RequisitionList() {
  return (
    <ProcurementList
      title="Purchase requisitions"
      description="Controlled PR lifecycle from draft through department and purchase review."
      resource="requisitions"
      permission="purchaseRequisition:read"
      createHref="/procurement/requisitions/new"
      createLabel="New PR"
      exportColumns={["requisitionNumber", "departmentId", "priority", "status", "requiredDate"]}
      rowHref={(row) => `/procurement/requisitions/${row.id}`}
      columns={[
        { key: "requisitionNumber", header: "PR" },
        { key: "purpose", header: "Purpose" },
        { key: "priority", header: "Priority", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(prStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function RfqList() {
  return (
    <ProcurementList
      title="RFQs"
      description="Requests for quotation issued to eligible vendors from approved requisitions."
      resource="rfqs"
      permission="rfq:read"
      createHref="/procurement/rfqs/new"
      createLabel="New RFQ"
      exportColumns={["rfqNumber", "requisitionId", "status", "responseDueDate"]}
      rowHref={(row) => `/procurement/rfqs/${row.id}`}
      columns={[
        { key: "rfqNumber", header: "RFQ" },
        { key: "responseDueDate", header: "Due" },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(rfqStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function QuotationList() {
  return (
    <ProcurementList
      title="Vendor quotations"
      description="Commercial responses against issued RFQs. Pricing is permission-controlled."
      resource="quotations"
      permission="quotation:read"
      createHref="/procurement/quotations/new"
      createLabel="Record quotation"
      exportColumns={["quotationNumber", "rfqId", "vendorId", "status", "validUntil"]}
      rowHref={(row) => `/procurement/quotations/${row.id}`}
      columns={[
        { key: "quotationNumber", header: "Quotation" },
        { key: "vendorId", header: "Vendor", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(quotationStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function PurchaseOrderList() {
  return (
    <ProcurementList
      title="Purchase orders"
      description="Approved supplier orders with remaining-quantity tracking into Goods Receipt."
      resource="orders"
      permission="purchaseOrder:read"
      createHref="/procurement/orders/new"
      createLabel="New PO"
      exportColumns={["poNumber", "vendorId", "status", "expectedDeliveryDate", "grandTotal"]}
      rowHref={(row) => `/procurement/orders/${row.id}`}
      columns={[
        { key: "poNumber", header: "PO" },
        { key: "vendorId", header: "Vendor" },
        { key: "expectedDeliveryDate", header: "Delivery", hideOnMobile: true },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(poStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function AmendmentList() {
  return (
    <ProcurementList
      title="PO amendments"
      description="Versioned changes to approved purchase orders. Original PO history is retained."
      resource="amendments"
      permission="purchaseOrderAmendment:create"
      createHref="/procurement/amendments/new"
      createLabel="New amendment"
      exportColumns={["amendmentNumber", "purchaseOrderId", "version", "status", "reason"]}
      rowHref={(row) => `/procurement/amendments/${row.id}`}
      columns={[
        { key: "amendmentNumber", header: "AMD" },
        { key: "version", header: "Version" },
        { key: "status", header: "Status", cell: (row) => <StatusBadge label={labelFor(amendmentStatusOptions, row.status)} tone={workflowTone(row.status)} /> },
      ]}
    />
  );
}

export function ProcurementDocumentDetail({
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
  permission: "purchaseRequisition:read" | "rfq:read" | "quotation:read" | "purchaseOrder:read" | "purchaseOrderAmendment:create";
  titleKey: string;
  statusOptions: Array<{ label: string; value: string }>;
  actions: ProcurementWorkflowAction[];
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
  actions: ProcurementWorkflowAction[];
  auditResource: string;
}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function reload() {
    void getProcurement(resource, id)
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
  const approvals = (extra.approvals as Row[]) || [];
  const vendors = (extra.vendors as Row[]) || [];

  async function selectFromRfq() {
    if (!reason) {
      toast.error("A selection reason is required");
      return;
    }
    try {
      await createProcurement("selections", {
        rfqId: id,
        quotationId: String(record?.quotationId || window.prompt("Quotation ID") || ""),
        selectionReason: reason,
        idempotencyKey: crypto.randomUUID(),
      });
      toast.success("Vendor selection submitted");
      reload();
    } catch (err) {
      toast.error("Unable to select vendor", publicMasterError(err));
    }
  }

  return (
    <div>
      <PageHeader
        title={String(record[titleKey] || id)}
        description="Server-validated procurement document with a complete audit trail."
        actions={
          resource === "orders" ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/procurement/tracking/${id}`}>Tracking</Link>
            </Button>
          ) : resource === "rfqs" ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/procurement/comparison/${id}`}>Compare quotations</Link>
            </Button>
          ) : null
        }
      />
      <ProcurementWorkflowActions
        resource={resource}
        id={id}
        status={String(record.status)}
        statusOptions={statusOptions}
        actions={actions}
        onChanged={reload}
      />
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {Object.entries(record)
          .filter(([key]) => !["searchIndex", "nameIndex", "createdBy", "updatedBy", "id", "_updateTime", "previousValues", "newValues"].includes(key))
          .slice(0, 12)
          .map(([key, value]) => (
            <Card key={key}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground">{key}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</CardContent>
            </Card>
          ))}
      </div>
      {vendors.length ? (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold">Invited vendors</h2>
          {vendors.map((vendor) => (
            <div key={vendor.id} className="rounded-lg border p-3 text-sm">
              {String(vendor.vendorId)} · {vendor.responded ? "Responded" : "Awaiting response"}
            </div>
          ))}
        </div>
      ) : null}
      {items.length ? (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold">Lines</h2>
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-sm">
              {String(item.materialId)} · {String(item.requiredQuantity || item.quantity || item.quotedQuantity || item.orderedQuantity || "")} {String(item.uom || "")}
              {item.receivedQuantity !== undefined ? ` · received ${String(item.receivedQuantity)}` : ""}
            </div>
          ))}
        </div>
      ) : null}
      {approvals.length ? (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold">Approval steps</h2>
          {approvals.map((step) => (
            <div key={step.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span>
                Step {String(step.step)} · {String(step.label || step.role)}
              </span>
              <StatusBadge label={String(step.status)} tone={workflowTone(step.status)} />
            </div>
          ))}
        </div>
      ) : null}
      {resource === "rfqs" ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select vendor</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <SelectionReasonField value={reason} onChange={setReason} />
            <Button className="min-h-11 md:self-end" onClick={() => void selectFromRfq()}>
              Submit selection
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <AuditHistory resource={auditResource} resourceId={id} />
    </div>
  );
}

export const prActions: ProcurementWorkflowAction[] = [
  { action: "submit", label: "Submit", permission: "purchaseRequisition:submit" },
  { action: "approve", label: "Approve", permission: "purchaseRequisition:approve" },
  { action: "reject", label: "Reject", permission: "purchaseRequisition:reject", variant: "destructive", requireReason: true },
  { action: "return", label: "Return", permission: "purchaseRequisition:reject", requireReason: true },
  { action: "review", label: "Purchase review", permission: "purchaseRequisition:update" },
  { action: "cancel", label: "Cancel", permission: "purchaseRequisition:cancel", variant: "destructive", requireReason: true },
];

export const rfqActions: ProcurementWorkflowAction[] = [
  { action: "issue", label: "Issue RFQ", permission: "rfq:issue" },
  { action: "evaluate", label: "Start evaluation", permission: "rfq:update" },
  { action: "close", label: "Close", permission: "rfq:close" },
  { action: "cancel", label: "Cancel", permission: "rfq:update", variant: "destructive", requireReason: true },
];

export const quotationActions: ProcurementWorkflowAction[] = [
  { action: "evaluate", label: "Under evaluation", permission: "quotation:evaluate" },
  { action: "cancel", label: "Cancel", permission: "quotation:update", variant: "destructive", requireReason: true },
];

export const poActions: ProcurementWorkflowAction[] = [
  { action: "submit", label: "Submit", permission: "purchaseOrder:submit" },
  { action: "approve", label: "Approve", permission: "purchaseOrder:approve" },
  { action: "reject", label: "Reject", permission: "purchaseOrder:reject", variant: "destructive", requireReason: true },
  { action: "return", label: "Return", permission: "purchaseOrder:reject", requireReason: true },
  { action: "send", label: "Send to vendor", permission: "purchaseOrder:update" },
  { action: "acknowledge", label: "Acknowledged", permission: "purchaseOrder:update" },
  { action: "close", label: "Close", permission: "purchaseOrder:update" },
  { action: "cancel", label: "Cancel", permission: "purchaseOrder:cancel", variant: "destructive", requireReason: true },
];

export const amendmentActions: ProcurementWorkflowAction[] = [
  { action: "approve", label: "Approve", permission: "purchaseOrderAmendment:approve" },
  { action: "reject", label: "Reject", permission: "purchaseOrderAmendment:approve", variant: "destructive", requireReason: true },
  { action: "cancel", label: "Cancel", permission: "purchaseOrderAmendment:create", variant: "destructive", requireReason: true },
];
