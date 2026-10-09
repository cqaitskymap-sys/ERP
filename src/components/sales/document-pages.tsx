"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { SalesList } from "@/components/sales/sales-list";
import { SalesWorkflowActions } from "@/components/sales/workflow-actions";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { getSales, runSalesAction } from "@/lib/sales/client";
import {
  cmoStatusOptions,
  labelFor,
  orderStatusOptions,
  priceListStatusOptions,
  quotationStatusOptions,
  requirementStatusOptions,
  returnStatusOptions,
  workflowTone,
} from "@/lib/sales/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

type Row = Record<string, unknown> & { id: string };

export function QuotationList() {
  return (
    <SalesList
      title="Quotations"
      description="Customer quotations with review, approval, and conversion to sales orders."
      resource="quotations"
      permission="salesQuotation:read"
      createHref="/sales/quotations/new"
      createLabel="New quotation"
      exportColumns={["quotationNumber", "customerId", "status", "grandTotal", "validUntil"]}
      columns={[
        { key: "quotationNumber", header: "Number" },
        { key: "customerId", header: "Customer" },
        { key: "status", header: "Status" },
        { key: "grandTotal", header: "Total", hideOnMobile: true },
        { key: "validUntil", header: "Valid until", hideOnMobile: true },
      ]}
      rowHref={(row) => `/sales/quotations/${row.id}`}
    />
  );
}

export function SalesOrderList() {
  return (
    <SalesList
      title="Sales orders"
      description="Order-to-cash lifecycle with approvals, allocation, and fulfilment tracking."
      resource="orders"
      permission="salesOrder:read"
      createHref="/sales/orders/new"
      createLabel="New sales order"
      exportColumns={["salesOrderNumber", "customerId", "status", "grandTotal", "promisedDeliveryDate"]}
      columns={[
        { key: "salesOrderNumber", header: "SO number" },
        { key: "customerId", header: "Customer" },
        { key: "orderType", header: "Type", hideOnMobile: true },
        { key: "status", header: "Status" },
        { key: "grandTotal", header: "Total", hideOnMobile: true },
        { key: "fulfilmentPercent", header: "Fulfilment %", hideOnMobile: true },
      ]}
      rowHref={(row) => `/sales/orders/${row.id}`}
    />
  );
}

export function PriceListPage() {
  return (
    <SalesList
      title="Product pricing"
      description="Customer and product price lists with effective dates and revision control."
      resource="priceLists"
      permission="salesPricing:read"
      createHref="/sales/pricing/new"
      createLabel="New price list"
      exportColumns={["priceListNumber", "name", "customerId", "status", "effectiveFrom"]}
      columns={[
        { key: "priceListNumber", header: "Number" },
        { key: "name", header: "Name" },
        { key: "customerId", header: "Customer" },
        { key: "status", header: "Status" },
        { key: "effectiveFrom", header: "Effective from", hideOnMobile: true },
      ]}
      rowHref={(row) => `/sales/pricing/${row.id}`}
    />
  );
}

export function RequirementList() {
  return (
    <SalesList
      title="Customer requirements"
      description="Packaging, COA, shelf-life, regulatory, and delivery requirements."
      resource="requirements"
      permission="salesRequirement:read"
      createHref="/sales/requirements/new"
      createLabel="New requirement"
      exportColumns={["requirementNumber", "customerId", "category", "title", "status"]}
      columns={[
        { key: "requirementNumber", header: "Number" },
        { key: "customerId", header: "Customer" },
        { key: "category", header: "Category" },
        { key: "title", header: "Title" },
        { key: "status", header: "Status" },
      ]}
      rowHref={(row) => `/sales/requirements/${row.id}`}
    />
  );
}

export function CmoList() {
  return (
    <SalesList
      title="Contract manufacturing orders"
      description="Third-party manufacturing commercial orders linked to approved technical records."
      resource="contractOrders"
      permission="contractManufacturing:read"
      createHref="/sales/cmo/new"
      createLabel="New CMO"
      exportColumns={["contractOrderNumber", "customerId", "productId", "status", "manufacturingQuantity"]}
      columns={[
        { key: "contractOrderNumber", header: "CMO number" },
        { key: "customerId", header: "Customer" },
        { key: "productId", header: "Product" },
        { key: "status", header: "Status" },
        { key: "manufacturingQuantity", header: "Qty", hideOnMobile: true },
      ]}
      rowHref={(row) => `/sales/cmo/${row.id}`}
    />
  );
}

export function ReturnList() {
  return (
    <SalesList
      title="Sales returns"
      description="Controlled returns with quarantine until QA disposition."
      resource="returns"
      permission="salesReturn:read"
      createHref="/sales/returns/new"
      createLabel="New return"
      exportColumns={["returnNumber", "customerId", "salesOrderId", "status", "quantity"]}
      columns={[
        { key: "returnNumber", header: "Return #" },
        { key: "customerId", header: "Customer" },
        { key: "salesOrderId", header: "Sales order" },
        { key: "status", header: "Status" },
        { key: "quantity", header: "Qty", hideOnMobile: true },
      ]}
      rowHref={(row) => `/sales/returns/${row.id}`}
    />
  );
}

export function CreditList() {
  return (
    <SalesList
      title="Credit & payment tracking"
      description="Receivable snapshots and credit reviews. Not a full finance ledger."
      resource="receivables"
      permission="salesCredit:read"
      createHref="/sales/credit/new"
      createLabel="New snapshot"
      exportColumns={["customerId", "creditLimit", "outstandingBalance", "overdueBalance", "asOfDate"]}
      columns={[
        { key: "customerId", header: "Customer" },
        { key: "creditLimit", header: "Credit limit" },
        { key: "outstandingBalance", header: "Outstanding" },
        { key: "overdueBalance", header: "Overdue" },
        { key: "asOfDate", header: "As of", hideOnMobile: true },
      ]}
      rowHref={(row) => `/sales/customers/${String(row.customerId)}`}
    />
  );
}

function DetailShell({
  permission,
  resource,
  id,
  titleKey,
  statusOptions,
  actions,
  children,
}: {
  permission: Parameters<typeof RequirePermission>[0]["permission"];
  resource: string;
  id: string;
  titleKey: string;
  statusOptions: Array<{ label: string; value: string }>;
  actions: Parameters<typeof SalesWorkflowActions>[0]["actions"];
  children?: (ctx: { record: Row; extra: Record<string, unknown>; reload: () => void }) => ReactNode;
}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [extra, setExtra] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  function load() {
    void getSales(resource, id)
      .then((result) => {
        setRecord(result.record as Row);
        setExtra(result.extra || {});
        setError(null);
      })
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [resource, id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) {
    return <EmptyState title="Unable to load record" description={error || "Not found."} />;
  }

  return (
    <RequirePermission permission={permission}>
      <div>
        <PageHeader
          title={String(record[titleKey] || record.id)}
          description={`${resource} detail with audited workflow actions.`}
          actions={
            resource === "quotations" ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/sales/quotations/${id}/print`}>Print / PDF</Link>
              </Button>
            ) : undefined
          }
        />
        <SalesWorkflowActions
          resource={resource}
          id={id}
          status={String(record.status || "")}
          statusOptions={statusOptions}
          actions={actions}
          onChanged={load}
        />
        {children?.({ record, extra, reload: load })}
      </div>
    </RequirePermission>
  );
}

export function QuotationDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission="salesQuotation:read"
      resource="quotations"
      id={id}
      titleKey="quotationNumber"
      statusOptions={quotationStatusOptions}
      actions={[
        { action: "submit_review", label: "Submit for review", permission: "salesQuotation:submit" },
        { action: "submit_approval", label: "Submit for approval", permission: "salesQuotation:submit" },
        { action: "approve", label: "Approve", permission: "salesQuotation:approve" },
        { action: "reject", label: "Reject", permission: "salesQuotation:approve", variant: "destructive", requireReason: true },
        { action: "mark_sent", label: "Record as sent (internal)", permission: "salesQuotation:send" },
        { action: "accept", label: "Mark accepted", permission: "salesQuotation:update" },
        { action: "convert", label: "Convert to sales order", permission: "salesOrder:create" },
        { action: "cancel", label: "Cancel", permission: "salesQuotation:cancel", variant: "destructive", requireReason: true },
      ]}
    >
      {({ record, extra }) => (
        <RecordSections
          record={record}
          fields={[
            "customerId",
            "quotationDate",
            "validUntil",
            "currency",
            "paymentTerms",
            "deliveryTerms",
            "subtotal",
            "discount",
            "tax",
            "grandTotal",
            "sentExternally",
          ]}
          items={(extra.items as Row[]) || []}
          approvals={(extra.approvals as Row[]) || []}
        />
      )}
    </DetailShell>
  );
}

export function SalesOrderDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission="salesOrder:read"
      resource="orders"
      id={id}
      titleKey="salesOrderNumber"
      statusOptions={orderStatusOptions}
      actions={[
        { action: "submit", label: "Submit for approval", permission: "salesOrder:submit" },
        { action: "approve", label: "Approve", permission: "salesOrder:approve" },
        { action: "reject", label: "Reject", permission: "salesOrder:approve", variant: "destructive", requireReason: true },
        { action: "confirm", label: "Commercial confirm", permission: "salesOrder:confirm" },
        { action: "allocate", label: "Allocate inventory", permission: "salesOrder:update", requireReason: false },
        { action: "availability", label: "Check availability", permission: "salesOrder:read" },
        { action: "transition", label: "Mark in production", permission: "salesOrder:update", payload: { toStatus: "in_production" } },
        { action: "transition", label: "Ready for dispatch", permission: "salesOrder:update", payload: { toStatus: "ready_for_dispatch" } },
        { action: "close", label: "Close order", permission: "salesOrder:close", requireReason: true },
        { action: "cancel", label: "Cancel", permission: "salesOrder:cancel", variant: "destructive", requireReason: true },
      ]}
    >
      {({ record, extra, reload }) => (
        <div className="space-y-6">
          <RecordSections
            record={record}
            fields={[
              "customerId",
              "orderType",
              "customerPoNumber",
              "promisedDeliveryDate",
              "paymentTerms",
              "warehouseId",
              "subtotal",
              "discount",
              "tax",
              "grandTotal",
              "fulfilmentPercent",
              "remainingQuantity",
            ]}
            items={(extra.items as Row[]) || []}
            approvals={(extra.approvals as Row[]) || []}
          />
          <BlockerPanel blockers={(extra.blockers as Array<{ label: string; severity: string }>) || []} />
          <HistoryPanel title="Status history" rows={(extra.history as Row[]) || []} />
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              void runSalesAction("orders", id, "availability", { warehouseId: String(record.warehouseId || "") })
                .then((result) => {
                  toast.success("Availability checked");
                  console.info(result);
                  reload();
                })
                .catch((error) => toast.error("Availability check failed", publicMasterError(error)));
            }}
          >
            Refresh availability check
          </Button>
        </div>
      )}
    </DetailShell>
  );
}

export function PriceListDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission="salesPricing:read"
      resource="priceLists"
      id={id}
      titleKey="priceListNumber"
      statusOptions={priceListStatusOptions}
      actions={[{ action: "activate", label: "Activate price list", permission: "salesPricing:approve", requireReason: true }]}
    >
      {({ record, extra }) => (
        <RecordSections
          record={record}
          fields={["name", "customerId", "currency", "effectiveFrom", "effectiveTo", "status"]}
          items={(extra.rules as Row[]) || []}
          itemColumns={["productId", "unitPrice", "minQuantity", "discountPercent", "status"]}
        />
      )}
    </DetailShell>
  );
}

export function RequirementDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission="salesRequirement:read"
      resource="requirements"
      id={id}
      titleKey="requirementNumber"
      statusOptions={requirementStatusOptions}
      actions={[
        { action: "transition", label: "Submit review", permission: "salesRequirement:approve", payload: { toStatus: "under_review" } },
        { action: "transition", label: "Approve", permission: "salesRequirement:approve", payload: { toStatus: "approved" }, requireReason: true },
        { action: "transition", label: "Activate", permission: "salesRequirement:approve", payload: { toStatus: "active" } },
      ]}
    >
      {({ record }) => (
        <RecordSections
          record={record}
          fields={[
            "customerId",
            "productId",
            "category",
            "title",
            "description",
            "status",
            "controlledWorkflowStatus",
            "affectsManufacturing",
            "affectsQuality",
            "affectsRegulatory",
          ]}
        />
      )}
    </DetailShell>
  );
}

export function CmoDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission="contractManufacturing:read"
      resource="contractOrders"
      id={id}
      titleKey="contractOrderNumber"
      statusOptions={cmoStatusOptions}
      actions={[
        { action: "submit", label: "Submit", permission: "contractManufacturing:submit" },
        { action: "approve", label: "Approve step", permission: "contractManufacturing:approve" },
        { action: "confirm_commercial", label: "Commercial confirm", permission: "contractManufacturing:approve" },
        { action: "link_production", label: "Link production", permission: "contractManufacturing:update", requireReason: true },
        { action: "cancel", label: "Cancel", permission: "contractManufacturing:cancel", variant: "destructive", requireReason: true },
      ]}
    >
      {({ record }) => (
        <RecordSections
          record={record}
          fields={[
            "customerId",
            "productId",
            "customerBrand",
            "manufacturingQuantity",
            "bomId",
            "regulatoryMarket",
            "productionAuthorized",
            "status",
          ]}
        />
      )}
    </DetailShell>
  );
}

export function ReturnDetail({ id }: { id: string }) {
  return (
    <DetailShell
      permission="salesReturn:read"
      resource="returns"
      id={id}
      titleKey="returnNumber"
      statusOptions={returnStatusOptions}
      actions={[
        { action: "transition", label: "Sales review", permission: "salesReturn:update", payload: { toStatus: "sales_review" } },
        { action: "transition", label: "QA assessment", permission: "salesReturn:approve", payload: { toStatus: "qa_assessment" } },
        { action: "transition", label: "Authorize", permission: "salesReturn:approve", payload: { toStatus: "authorized" }, requireReason: true },
        { action: "transition", label: "Receive to quarantine", permission: "salesReturn:approve", payload: { toStatus: "quarantine" } },
        { action: "transition", label: "QA disposition", permission: "salesReturn:approve", payload: { toStatus: "qa_disposition" }, requireReason: true },
        { action: "transition", label: "Close", permission: "salesReturn:close", payload: { toStatus: "closed" }, requireReason: true },
      ]}
    >
      {({ record }) => (
        <RecordSections
          record={record}
          fields={[
            "customerId",
            "salesOrderId",
            "productId",
            "batchNumber",
            "quantity",
            "reason",
            "inventoryDisposition",
            "autoRestock",
            "status",
          ]}
        />
      )}
    </DetailShell>
  );
}

function RecordSections({
  record,
  fields,
  items = [],
  approvals = [],
  itemColumns = ["productId", "quantity", "unitPrice", "discount", "tax", "lineTotal"],
}: {
  record: Row;
  fields: string[];
  items?: Row[];
  approvals?: Row[];
  itemColumns?: string[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <div key={field}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{field}</p>
            <p className="mt-1 text-sm font-medium break-all">{formatValue(record[field])}</p>
          </div>
        ))}
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">status</p>
          <div className="mt-1">
            <StatusBadge
              label={labelFor(
                [...quotationStatusOptions, ...orderStatusOptions, ...returnStatusOptions, ...cmoStatusOptions, ...requirementStatusOptions, ...priceListStatusOptions],
                String(record.status || "")
              )}
              tone={workflowTone(String(record.status || ""))}
            />
          </div>
        </div>
      </div>
      {items.length ? (
        <div className="rounded-xl border">
          <div className="border-b px-4 py-3 text-sm font-medium">Lines / rules</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {itemColumns.map((column) => (
                    <th key={column} className="px-4 py-2 font-medium">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id || String(item.lineId || item.ruleId)} className="border-b last:border-0">
                    {itemColumns.map((column) => (
                      <td key={column} className="px-4 py-2">
                        {formatValue(item[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {approvals.length ? <HistoryPanel title="Approvals" rows={approvals} /> : null}
    </div>
  );
}

function BlockerPanel({ blockers }: { blockers: Array<{ label: string; severity: string }> }) {
  if (!blockers.length) return null;
  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50/50 p-4 dark:bg-amber-950/20">
      <p className="mb-2 text-sm font-medium">Order blockers</p>
      <ul className="space-y-1 text-sm">
        {blockers.map((blocker, index) => (
          <li key={`${blocker.label}-${index}`}>
            [{blocker.severity}] {blocker.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryPanel({ title, rows }: { title: string; rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg bg-muted/40 px-3 py-2">
            {formatValue(row.label || row.toStatus || row.status)} · {formatValue(row.comment || row.reason || "")} ·{" "}
            {formatValue(row.updatedAt || row.performedAt || row.timestamp)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
