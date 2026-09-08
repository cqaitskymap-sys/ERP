"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProductionReport } from "@/lib/production/client";
import { productionReportOptions } from "@/lib/production/catalog";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function ProductionReportsPage() {
  return (
    <RequirePermission permission="production:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [type, setType] = useState("manufacturing_order");
  const [status, setStatus] = useState("");
  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [plantId, setPlantId] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id?: string }>>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const result = await getProductionReport(type, { status, productId, customerId, plantId });
      setRows(result.rows.map((row, index) => ({ id: String(row.id || index), ...row })));
    } catch (error) {
      toast.error("Unable to load report", publicMasterError(error));
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { key: "planNumber", header: "Plan" },
    { key: "scheduleNumber", header: "Schedule" },
    { key: "manufacturingOrderNumber", header: "MO" },
    { key: "batchNumber", header: "Batch" },
    { key: "productId", header: "Product" },
    { key: "customerId", header: "Customer" },
    { key: "status", header: "Status" },
    { key: "yieldPercentage", header: "Yield" },
    { key: "workCenterId", header: "Work center" },
  ];

  return (
    <div>
      <PageHeader
        title="Production reports"
        description="Date, product, customer, plant, and status filters query Firestore. Export uses the current result set."
        actions={
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => downloadCsv(`${type}.csv`, recordsToCsv(rows, columns.map((column) => column.key)))}
          >
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {productionReportOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="min-h-11" placeholder="Status" value={status} onChange={(event) => setStatus(event.target.value)} />
        <Input className="min-h-11" placeholder="Product ID" value={productId} onChange={(event) => setProductId(event.target.value)} />
        <Input className="min-h-11" placeholder="Customer ID" value={customerId} onChange={(event) => setCustomerId(event.target.value)} />
        <Input className="min-h-11" placeholder="Plant ID" value={plantId} onChange={(event) => setPlantId(event.target.value)} />
        <Button className="min-h-11" onClick={() => void run()}>{loading ? "Loading…" : "Run report"}</Button>
      </div>
      <DataTable columns={columns} data={rows} loading={loading} searchable={false} paginate={false} emptyTitle="No report rows" />
    </div>
  );
}
