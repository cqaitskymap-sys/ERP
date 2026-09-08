"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { AuditHistory } from "@/components/products/audit-history";
import { MasterPick } from "@/components/warehouse/master-pick";
import { WarehouseList } from "@/components/warehouse/warehouse-list";
import { WorkflowActions, type WorkflowAction } from "@/components/warehouse/workflow-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createWarehouse, getWarehouse, runWarehouseAction } from "@/lib/inventory/client";
import {
  adjustmentReasonOptions,
  adjustmentStatusOptions,
  issueStatusOptions,
  labelFor,
  receiptStatusOptions,
  returnReasonOptions,
  returnStatusOptions,
  transferStatusOptions,
  verificationStatusOptions,
  workflowTone,
  qualityStatusOptions,
} from "@/lib/inventory/catalog";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

export function ReceiptList() {
  return (
    <WarehouseList
      title="Goods receipts"
      description="Incoming stock starts in quarantine. Link an approved purchase order to track remaining quantity."
      resource="receipts"
      permission="goodsReceipt:read"
      createHref="/warehouse/receipts/new"
      createLabel="New receipt"
      exportColumns={["receiptNumber", "receiptDate", "supplierId", "warehouseId", "status"]}
      rowHref={(row) => `/warehouse/receipts/${row.id}`}
      columns={[
        { key: "receiptNumber", header: "GRN" },
        { key: "receiptDate", header: "Date" },
        { key: "supplierId", header: "Supplier", hideOnMobile: true },
        { key: "warehouseId", header: "Warehouse", hideOnMobile: true },
        {
          key: "status",
          header: "Status",
          cell: (row) => <StatusBadge label={labelFor(receiptStatusOptions, row.status)} tone={workflowTone(row.status)} />,
        },
      ]}
    />
  );
}

export function TransferList() {
  return (
    <WarehouseList
      title="Stock transfers"
      description="Warehouse-to-warehouse and location-to-location movement."
      resource="transfers"
      permission="inventory:read"
      createHref="/warehouse/transfers/new"
      createLabel="New transfer"
      exportColumns={["transferNumber", "fromWarehouseId", "toWarehouseId", "status"]}
      rowHref={(row) => `/warehouse/transfers/${row.id}`}
      columns={[
        { key: "transferNumber", header: "TRF" },
        { key: "fromWarehouseId", header: "From" },
        { key: "toWarehouseId", header: "To" },
        {
          key: "status",
          header: "Status",
          cell: (row) => <StatusBadge label={labelFor(transferStatusOptions, row.status)} tone={workflowTone(row.status)} />,
        },
      ]}
    />
  );
}

export function IssueList() {
  return (
    <WarehouseList
      title="Material issues"
      description="Issue foundation for future dispensing and production."
      resource="issues"
      permission="inventory:read"
      createHref="/warehouse/issues/new"
      createLabel="New issue"
      exportColumns={["issueNumber", "warehouseId", "issuedTo", "status"]}
      rowHref={(row) => `/warehouse/issues/${row.id}`}
      columns={[
        { key: "issueNumber", header: "ISS" },
        { key: "warehouseId", header: "Warehouse" },
        { key: "issuedTo", header: "Issued to", hideOnMobile: true },
        {
          key: "status",
          header: "Status",
          cell: (row) => <StatusBadge label={labelFor(issueStatusOptions, row.status)} tone={workflowTone(row.status)} />,
        },
      ]}
    />
  );
}

export function ReturnList() {
  return (
    <WarehouseList
      title="Material returns"
      description="Returned material stays traceable and is not automatically approved."
      resource="returns"
      permission="inventory:read"
      createHref="/warehouse/returns/new"
      createLabel="New return"
      exportColumns={["returnNumber", "originalIssueId", "qualityStatus", "status"]}
      rowHref={(row) => `/warehouse/returns/${row.id}`}
      columns={[
        { key: "returnNumber", header: "RET" },
        { key: "originalIssueId", header: "Original issue", hideOnMobile: true },
        { key: "qualityStatus", header: "Quality" },
        {
          key: "status",
          header: "Status",
          cell: (row) => <StatusBadge label={labelFor(returnStatusOptions, row.status)} tone={workflowTone(row.status)} />,
        },
      ]}
    />
  );
}

export function AdjustmentList() {
  return (
    <WarehouseList
      title="Stock adjustments"
      description="Quantity is never edited directly. Adjustments require approval."
      resource="adjustments"
      permission="inventory:read"
      createHref="/warehouse/adjustments/new"
      createLabel="New adjustment"
      exportColumns={["adjustmentNumber", "previousQuantity", "adjustedQuantity", "reason", "status"]}
      rowHref={(row) => `/warehouse/adjustments/${row.id}`}
      columns={[
        { key: "adjustmentNumber", header: "ADJ" },
        { key: "previousQuantity", header: "Previous" },
        { key: "adjustedQuantity", header: "Adjusted" },
        { key: "reason", header: "Reason", hideOnMobile: true },
        {
          key: "status",
          header: "Status",
          cell: (row) => <StatusBadge label={labelFor(adjustmentStatusOptions, row.status)} tone={workflowTone(row.status)} />,
        },
      ]}
    />
  );
}

export function LedgerList() {
  return (
    <WarehouseList
      title="Stock ledger"
      description="Immutable movement history. Historical ledger rows cannot be edited."
      resource="ledger"
      permission="inventory:read"
      exportColumns={["transactionNumber", "transactionType", "batchNumber", "quantityIn", "quantityOut", "balanceAfter"]}
      rowHref={() => "/warehouse/ledger"}
      columns={[
        { key: "transactionNumber", header: "Number" },
        { key: "transactionType", header: "Type" },
        { key: "batchNumber", header: "Batch" },
        { key: "quantityIn", header: "In" },
        { key: "quantityOut", header: "Out" },
        { key: "balanceAfter", header: "Balance", hideOnMobile: true },
        { key: "performedAt", header: "When", hideOnMobile: true },
      ]}
    />
  );
}

export function DocumentDetail({
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
  permission: Permission;
  titleKey: string;
  statusOptions: Array<{ label: string; value: string }>;
  actions: WorkflowAction[];
  auditResource: string;
}) {
  return (
    <RequirePermission permission={permission}>
      <DocumentDetailInner
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

function DocumentDetailInner({
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
  actions: WorkflowAction[];
  auditResource: string;
}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState({
    quantityReceived: "",
    packageCount: "",
    packageCondition: "good",
    labelCondition: "intact",
    sealCondition: "intact",
    verificationStatus: "verified",
    remarks: "",
  });

  function reload() {
    void getWarehouse(resource, id)
      .then((result) => {
        setRecord(result.record);
        setItems(((result.extra?.items as Row[]) || []).map((item) => item));
      })
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getWarehouse(resource, id)
        .then((result) => {
          setRecord(result.record);
          setItems(((result.extra?.items as Row[]) || []).map((item) => item));
        })
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resource, id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) return <EmptyState title="Record not found" description={error || ""} />;

  return (
    <div>
      <PageHeader title={String(record[titleKey] || id)} description="Server-validated warehouse document." />
      <WorkflowActions
        resource={resource}
        id={id}
        status={String(record.status)}
        statusOptions={statusOptions}
        actions={actions}
        onChanged={reload}
      />
      {resource === "receipts" && (record.status === "received" || record.status === "under_inspection") ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Receiving check</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Field label="Quantity received">
              <Input className="min-h-11" value={verification.quantityReceived} onChange={(event) => setVerification({ ...verification, quantityReceived: event.target.value })} />
            </Field>
            <Field label="Packages">
              <Input className="min-h-11" value={verification.packageCount} onChange={(event) => setVerification({ ...verification, packageCount: event.target.value })} />
            </Field>
            <Field label="Verification">
              <Select value={verification.verificationStatus} onValueChange={(verificationStatus) => setVerification({ ...verification, verificationStatus })}>
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {verificationStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Remarks">
              <Textarea value={verification.remarks} onChange={(event) => setVerification({ ...verification, remarks: event.target.value })} />
            </Field>
            <Button
              className="min-h-11 md:col-span-2"
              onClick={() => {
                void runWarehouseAction(resource, id, "verify", {
                  verification: {
                    ...verification,
                    quantityReceived: Number(verification.quantityReceived || 0),
                    packageCount: Number(verification.packageCount || 0),
                    batchNumberConfirmed: true,
                    expiryConfirmed: true,
                    supplierConfirmed: true,
                    materialIdentityConfirmed: true,
                    documentationAvailable: true,
                  },
                })
                  .then(() => {
                    toast.success("Receipt verified");
                    reload();
                  })
                  .catch((err) => toast.error("Verification failed", publicMasterError(err)));
              }}
            >
              Save receiving check
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <div className="mb-6 grid gap-3 md:grid-cols-2">
        {Object.entries(record)
          .filter(([key]) => !["searchIndex", "nameIndex", "createdBy", "updatedBy", "id", "_updateTime"].includes(key))
          .slice(0, 10)
          .map(([key, value]) => (
            <Card key={key}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground">{key}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{String(value ?? "—")}</CardContent>
            </Card>
          ))}
      </div>
      {items.length ? (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold">Items</h2>
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-sm">
              {String(item.itemCode || item.batchNumber || item.id)} · {String(item.quantity || "")} {String(item.uom || "")}
            </div>
          ))}
        </div>
      ) : null}
      <AuditHistory resource={auditResource} resourceId={id} />
    </div>
  );
}

export function TransferForm() {
  return <SimpleCreateForm permission="stockTransfer:create" title="New stock transfer" resource="transfers" href="/warehouse/transfers" fields="transfer" />;
}

export function IssueForm() {
  return <SimpleCreateForm permission="stockIssue:create" title="New material issue" resource="issues" href="/warehouse/issues" fields="issue" />;
}

export function ReturnForm() {
  return <SimpleCreateForm permission="stockReturn:create" title="New material return" resource="returns" href="/warehouse/returns" fields="return" />;
}

export function AdjustmentForm() {
  return <SimpleCreateForm permission="stockAdjustment:create" title="New stock adjustment" resource="adjustments" href="/warehouse/adjustments" fields="adjustment" />;
}

function SimpleCreateForm({
  permission,
  title,
  resource,
  href,
  fields,
}: {
  permission: Permission;
  title: string;
  resource: string;
  href: string;
  fields: "transfer" | "issue" | "return" | "adjustment";
}) {
  const router = useRouter();
  const params = useSearchParams();
  const balanceId = params.get("balanceId") || "";
  const [values, setValues] = useState<Record<string, string>>({
    fromWarehouseId: "",
    fromLocationId: "",
    toWarehouseId: "",
    toLocationId: "",
    warehouseId: "",
    locationId: "",
    reason: "",
    remarks: "",
    materialId: "",
    batchNumber: "",
    quantity: "",
    uom: "",
    issuedTo: "",
    department: "",
    originalIssueId: "",
    returnReason: "unused",
    qualityStatus: "returned",
    adjustedQuantity: "",
    adjustmentReason: "physical_count",
    balanceId,
  });

  async function submit() {
    try {
      const payload =
        fields === "transfer"
          ? {
              fromWarehouseId: values.fromWarehouseId,
              fromLocationId: values.fromLocationId,
              toWarehouseId: values.toWarehouseId,
              toLocationId: values.toLocationId,
              reason: values.reason,
              remarks: values.remarks,
              idempotencyKey: crypto.randomUUID(),
              items: [
                {
                  materialId: values.materialId,
                  batchNumber: values.batchNumber,
                  quantity: Number(values.quantity),
                  uom: values.uom,
                  balanceId: values.balanceId || undefined,
                  itemType: "material",
                },
              ],
            }
          : fields === "issue"
            ? {
                warehouseId: values.warehouseId,
                locationId: values.locationId,
                issuedTo: values.issuedTo,
                department: values.department,
                remarks: values.remarks,
                idempotencyKey: crypto.randomUUID(),
                items: [
                  {
                    materialId: values.materialId,
                    batchNumber: values.batchNumber,
                    quantity: Number(values.quantity),
                    uom: values.uom,
                    balanceId: values.balanceId || undefined,
                    useFefo: !values.batchNumber,
                    itemType: "material",
                  },
                ],
              }
            : fields === "return"
              ? {
                  originalIssueId: values.originalIssueId,
                  warehouseId: values.warehouseId,
                  locationId: values.locationId,
                  returnReason: values.returnReason,
                  qualityStatus: values.qualityStatus,
                  remarks: values.remarks,
                  idempotencyKey: crypto.randomUUID(),
                  items: [
                    {
                      materialId: values.materialId,
                      batchNumber: values.batchNumber,
                      quantity: Number(values.quantity),
                      uom: values.uom,
                      itemType: "material",
                    },
                  ],
                }
              : {
                  balanceId: values.balanceId,
                  adjustedQuantity: Number(values.adjustedQuantity),
                  reason: values.adjustmentReason,
                  remarks: values.remarks,
                  idempotencyKey: crypto.randomUUID(),
                };
      const result = await createWarehouse(resource, payload);
      toast.success("Draft created");
      router.push(`${href}/${result.id}`);
    } catch (error) {
      toast.error("Unable to save", publicMasterError(error));
    }
  }

  return (
    <RequirePermission permission={permission}>
      <div>
        <PageHeader title={title} description="Draft is saved first. Stock moves only after the authorized completion action." />
        <div className="grid gap-3 md:grid-cols-2">
          {fields === "transfer" ? (
            <>
              <MasterPick entity="warehouses" label="From warehouse" required value={values.fromWarehouseId} onChange={(fromWarehouseId) => setValues({ ...values, fromWarehouseId })} />
              <MasterPick entity="storageLocations" label="From location" required warehouseId={values.fromWarehouseId} value={values.fromLocationId} onChange={(fromLocationId) => setValues({ ...values, fromLocationId })} />
              <MasterPick entity="warehouses" label="To warehouse" required value={values.toWarehouseId} onChange={(toWarehouseId) => setValues({ ...values, toWarehouseId })} />
              <MasterPick entity="storageLocations" label="To location" required warehouseId={values.toWarehouseId} value={values.toLocationId} onChange={(toLocationId) => setValues({ ...values, toLocationId })} />
            </>
          ) : (
            <>
              {fields !== "adjustment" ? (
                <>
                  <MasterPick entity="warehouses" label="Warehouse" required value={values.warehouseId} onChange={(warehouseId) => setValues({ ...values, warehouseId })} />
                  <MasterPick entity="storageLocations" label="Location" required warehouseId={values.warehouseId} value={values.locationId} onChange={(locationId) => setValues({ ...values, locationId })} />
                </>
              ) : null}
            </>
          )}
          {fields !== "adjustment" ? (
            <>
              <MasterPick entity="materials" label="Material" required value={values.materialId} onChange={(materialId) => setValues({ ...values, materialId })} />
              <Field label="Batch">
                <Input className="min-h-11" value={values.batchNumber} onChange={(event) => setValues({ ...values, batchNumber: event.target.value })} />
              </Field>
              <Field label="Quantity">
                <Input className="min-h-11" type="number" value={values.quantity} onChange={(event) => setValues({ ...values, quantity: event.target.value })} />
              </Field>
              <MasterPick entity="uoms" label="UOM" required value={values.uom} onChange={(uom) => setValues({ ...values, uom })} />
            </>
          ) : (
            <>
              <Field label="Balance ID">
                <Input className="min-h-11" value={values.balanceId} onChange={(event) => setValues({ ...values, balanceId: event.target.value })} />
              </Field>
              <Field label="Adjusted quantity">
                <Input className="min-h-11" type="number" value={values.adjustedQuantity} onChange={(event) => setValues({ ...values, adjustedQuantity: event.target.value })} />
              </Field>
              <Field label="Reason">
                <Select value={values.adjustmentReason} onValueChange={(adjustmentReason) => setValues({ ...values, adjustmentReason })}>
                  <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {adjustmentReasonOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
          {fields === "issue" ? (
            <Field label="Issued to">
              <Input className="min-h-11" value={values.issuedTo} onChange={(event) => setValues({ ...values, issuedTo: event.target.value })} />
            </Field>
          ) : null}
          {fields === "return" ? (
            <>
              <Field label="Original issue ID">
                <Input className="min-h-11" value={values.originalIssueId} onChange={(event) => setValues({ ...values, originalIssueId: event.target.value })} />
              </Field>
              <Field label="Return reason">
                <Select value={values.returnReason} onValueChange={(returnReason) => setValues({ ...values, returnReason })}>
                  <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {returnReasonOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Return quality">
                <Select value={values.qualityStatus} onValueChange={(qualityStatus) => setValues({ ...values, qualityStatus })}>
                  <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {qualityStatusOptions.filter((option) => option.value !== "approved").map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          ) : null}
          {fields === "transfer" ? (
            <Field label="Reason">
              <Input className="min-h-11" value={values.reason} onChange={(event) => setValues({ ...values, reason: event.target.value })} />
            </Field>
          ) : null}
          <Field label="Remarks">
            <Textarea value={values.remarks} onChange={(event) => setValues({ ...values, remarks: event.target.value })} />
          </Field>
        </div>
        <Button className="mt-4 min-h-11" onClick={() => void submit()}>
          Save draft
        </Button>
      </div>
    </RequirePermission>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export const receiptActions: WorkflowAction[] = [
  { action: "receive", label: "Receive into quarantine", permission: "goodsReceipt:create" },
  { action: "cancel", label: "Cancel draft", permission: "goodsReceipt:create", variant: "destructive", requireReason: true },
];

export const transferActions: WorkflowAction[] = [
  { action: "request", label: "Submit", permission: "stockTransfer:create" },
  { action: "approve", label: "Approve", permission: "stockTransfer:approve" },
  { action: "start", label: "Start transit", permission: "stockTransfer:complete" },
  { action: "complete", label: "Complete transfer", permission: "stockTransfer:complete" },
  { action: "cancel", label: "Cancel", permission: "stockTransfer:create", variant: "destructive", requireReason: true },
];

export const issueActions: WorkflowAction[] = [
  { action: "request", label: "Submit", permission: "stockIssue:create" },
  { action: "approve", label: "Approve", permission: "stockIssue:approve" },
  { action: "complete", label: "Issue stock", permission: "stockIssue:complete" },
  { action: "cancel", label: "Cancel", permission: "stockIssue:create", variant: "destructive", requireReason: true },
];

export const returnActions: WorkflowAction[] = [
  { action: "request", label: "Submit", permission: "stockReturn:create" },
  { action: "receive", label: "Receive", permission: "stockReturn:create" },
  { action: "verify", label: "Verify", permission: "stockReturn:verify" },
  { action: "complete", label: "Complete return", permission: "stockReturn:verify" },
  { action: "reject", label: "Reject", permission: "stockReturn:verify", variant: "destructive", requireReason: true },
];

export const adjustmentActions: WorkflowAction[] = [
  { action: "request", label: "Submit for approval", permission: "stockAdjustment:create" },
  { action: "approve", label: "Approve adjustment", permission: "stockAdjustment:approve" },
  { action: "cancel", label: "Cancel", permission: "stockAdjustment:create", variant: "destructive", requireReason: true },
];
