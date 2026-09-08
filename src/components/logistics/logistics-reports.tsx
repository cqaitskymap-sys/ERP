"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getLogisticsReport } from "@/lib/logistics/client";
import { reportTypeOptions } from "@/lib/logistics/catalog";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function LogisticsReportsPage() {
  return (
    <RequirePermission permission="warehouseLogisticsReports:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [type, setType] = useState("inventory");
  const [status, setStatus] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id?: string }>>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const result = await getLogisticsReport(type, { status, warehouseId, customerId, batchNumber });
      setRows(result.rows.map((row, index) => ({ id: String(row.id || index), ...row })));
    } catch (error) {
      toast.error("Unable to load report", publicMasterError(error));
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { key: "shipmentNumber", header: "Shipment" },
    { key: "pickNumber", header: "Pick" },
    { key: "batchNumber", header: "Batch" },
    { key: "warehouseId", header: "Warehouse" },
    { key: "customerId", header: "Customer" },
    { key: "status", header: "Status" },
    { key: "quantity", header: "Qty" },
    { key: "availableQuantity", header: "Available" },
  ];

  return (
    <div>
      <PageHeader
        title="Warehouse & logistics reports"
        description="Inventory, FEFO, shipment, return, temperature, and recall-distribution reports query Firestore."
        actions={<Button variant="outline" className="min-h-11" onClick={() => downloadCsv(`${type}.csv`, recordsToCsv(rows, columns.map((column) => column.key)))}>Export CSV</Button>}
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{reportTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="min-h-11" placeholder="Status" value={status} onChange={(event) => setStatus(event.target.value)} />
        <Input className="min-h-11" placeholder="Warehouse ID" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} />
        <Input className="min-h-11" placeholder="Customer ID" value={customerId} onChange={(event) => setCustomerId(event.target.value)} />
        <Input className="min-h-11" placeholder="Batch" value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} />
        <Button className="min-h-11" disabled={loading} onClick={() => void run()}>Run report</Button>
      </div>
      <DataTable columns={columns} data={rows} loading={loading} searchable={false} paginate emptyTitle="Run a report to load rows." />
    </div>
  );
}
