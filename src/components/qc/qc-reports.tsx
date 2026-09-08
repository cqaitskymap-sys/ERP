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
import { getQcReport } from "@/lib/qc/client";
import { qcReportOptions } from "@/lib/qc/catalog";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function QcReportsPage() {
  return (
    <RequirePermission permission="qc:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [type, setType] = useState("sample_register");
  const [status, setStatus] = useState("");
  const [productId, setProductId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [analystId, setAnalystId] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id?: string }>>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const result = await getQcReport(type, { status, productId, materialId, batchNumber, customerId, vendorId, analystId });
      setRows(result.rows.map((row, index) => ({ id: String(row.id || index), ...row })));
    } catch (error) {
      toast.error("Unable to load report", publicMasterError(error));
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { key: "sampleNumber", header: "Sample" },
    { key: "testNumber", header: "Test" },
    { key: "coaNumber", header: "COA" },
    { key: "oosNumber", header: "OOS" },
    { key: "batchNumber", header: "Batch" },
    { key: "productId", header: "Product" },
    { key: "materialId", header: "Material" },
    { key: "vendorId", header: "Vendor" },
    { key: "customerId", header: "Customer" },
    { key: "analystId", header: "Analyst" },
    { key: "status", header: "Status" },
    { key: "overallResult", header: "Result" },
  ];

  return (
    <div>
      <PageHeader
        title="QC reports"
        description="Sample, test, OOS, COA, TAT, and supplier quality reports query Firestore. Export uses the current result set."
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
      <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {qcReportOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="min-h-11" placeholder="Status" value={status} onChange={(event) => setStatus(event.target.value)} />
        <Input className="min-h-11" placeholder="Product ID" value={productId} onChange={(event) => setProductId(event.target.value)} />
        <Input className="min-h-11" placeholder="Material ID" value={materialId} onChange={(event) => setMaterialId(event.target.value)} />
        <Input className="min-h-11" placeholder="Batch" value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} />
        <Input className="min-h-11" placeholder="Customer ID" value={customerId} onChange={(event) => setCustomerId(event.target.value)} />
        <Input className="min-h-11" placeholder="Vendor ID" value={vendorId} onChange={(event) => setVendorId(event.target.value)} />
        <Input className="min-h-11" placeholder="Analyst ID" value={analystId} onChange={(event) => setAnalystId(event.target.value)} />
        <Button className="min-h-11" onClick={() => void run()}>Run report</Button>
      </div>
      <DataTable
        columns={columns}
        data={rows.map((row) => ({ ...row, id: String(row.id) }))}
        loading={loading}
        searchable={false}
        paginate={false}
        emptyTitle="No QC report rows"
      />
    </div>
  );
}
