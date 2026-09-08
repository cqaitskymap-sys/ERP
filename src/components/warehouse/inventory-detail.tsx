"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { AuditHistory } from "@/components/products/audit-history";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { getWarehouse, transitionQuality } from "@/lib/inventory/client";
import {
  inventoryItemTypeOptions,
  inventoryStatusOptions,
  labelFor,
  qualityStatusOptions,
  qualityTone,
  rejectionDispositionOptions,
} from "@/lib/inventory/catalog";
import { allowedQualityTransitions } from "@/lib/inventory/quality";
import { classifyInventoryExpiry, inventoryExpiryLabel } from "@/lib/inventory/expiry";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function InventoryDetail({ id }: { id: string }) {
  return (
    <RequirePermission permission="inventory:read">
      <DetailInner id={id} />
    </RequirePermission>
  );
}

function DetailInner({ id }: { id: string }) {
  const { can } = useAuth();
  const [record, setRecord] = useState<(Record<string, unknown> & { id: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState("");
  const [reason, setReason] = useState("");
  const [quantity, setQuantity] = useState("");
  const [disposition, setDisposition] = useState("other");

  function reload() {
    void getWarehouse("inventory", id)
      .then((result) => {
        setRecord(result.record);
        setQuantity(String(result.record.availableQuantity || ""));
      })
      .catch((err) => setError(publicMasterError(err)));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void getWarehouse("inventory", id)
        .then((result) => {
          setRecord(result.record);
          setQuantity(String(result.record.availableQuantity || ""));
        })
        .catch((err) => setError(publicMasterError(err)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (!record && !error) return <LoadingState />;
  if (error || !record) return <EmptyState title="Balance not found" description={error || ""} />;

  const next = allowedQualityTransitions(String(record.qualityStatus));

  async function changeQuality() {
    try {
      await transitionQuality({
        balanceId: id,
        nextQualityStatus: nextStatus,
        reason,
        quantity: quantity ? Number(quantity) : undefined,
        disposition: nextStatus === "rejected" ? disposition : undefined,
      });
      toast.success("Quality status updated");
      reload();
    } catch (err) {
      toast.error("Quality change failed", publicMasterError(err));
    }
  }

  return (
    <div>
      <PageHeader
        title={`${record.itemCode} · ${record.batchNumber}`}
        description="Inventory is stored by material/product, batch, warehouse, location, and quality status."
        actions={
          <>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/warehouse/stock-card?itemId=${String(record.itemId)}&batchNumber=${String(record.batchNumber)}`}>
                Stock card
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/warehouse/traceability?batchNumber=${String(record.batchNumber)}`}>Trace batch</Link>
            </Button>
            {record.inventoryBatchId ? (
              <Button asChild className="min-h-11">
                <Link href={`/warehouse/batches/${String(record.inventoryBatchId)}`}>Batch detail</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Fact label="Item" value={`${record.itemCode} · ${record.itemName}`} />
        <Fact label="Type" value={labelFor(inventoryItemTypeOptions, record.itemType)} />
        <Fact label="Quantity" value={`${record.availableQuantity} ${record.uom || ""}`} />
        <Fact
          label="Quality"
          value={
            <StatusBadge label={labelFor(qualityStatusOptions, record.qualityStatus)} tone={qualityTone(record.qualityStatus)} />
          }
        />
        <Fact label="Warehouse" value={String(record.warehouseId)} />
        <Fact label="Location" value={String(record.locationId)} />
        <Fact label="Inventory status" value={labelFor(inventoryStatusOptions, record.inventoryStatus)} />
        <Fact label="Expiry" value={inventoryExpiryLabel(classifyInventoryExpiry(record.expiryDate))} />
      </div>
      <Tabs defaultValue="quality">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="audit">Audit history</TabsTrigger>
        </TabsList>
        <TabsContent value="quality">
          <Card>
            <CardHeader>
              <CardTitle>Controlled quality transition</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Next status</Label>
                <Select value={nextStatus} onValueChange={setNextStatus}>
                  <SelectTrigger className="min-h-11">
                    <SelectValue placeholder="Select allowed status" />
                  </SelectTrigger>
                  <SelectContent>
                    {next.map((status) => (
                      <SelectItem key={status} value={status}>
                        {labelFor(qualityStatusOptions, status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input className="min-h-11" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </div>
              {nextStatus === "rejected" ? (
                <div className="space-y-1.5">
                  <Label>Disposition</Label>
                  <Select value={disposition} onValueChange={setDisposition}>
                    <SelectTrigger className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rejectionDispositionOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-1.5 md:col-span-2">
                <Label>Reason</Label>
                <Textarea value={reason} onChange={(event) => setReason(event.target.value)} />
              </div>
              <Button className="min-h-11 md:col-span-2" onClick={() => void changeQuality()}>
                Apply quality change
              </Button>
              <p className="text-xs text-muted-foreground md:col-span-2">
                Warehouse users cannot release material. Approval, rejection, block, and unblock require quality permissions.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="actions">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/warehouse/transfers/new?balanceId=${id}`}>Transfer</Link>
            </Button>
            {can("stockIssue:create") ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/warehouse/issues/new?balanceId=${id}`}>Issue</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/warehouse/adjustments/new?balanceId=${id}`}>Adjust</Link>
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="audit">
          <AuditHistory resource="inventoryBalances" resourceId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm font-medium">{value}</CardContent>
    </Card>
  );
}
