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
import { getQaReport } from "@/lib/qa/client";
import { qaReportOptions } from "@/lib/qa/catalog";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function QaReportsPage() {
  return (
    <RequirePermission permission="qa:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [type, setType] = useState("qa_review");
  const [status, setStatus] = useState("");
  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id?: string }>>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const result = await getQaReport(type, { status, productId, customerId, batchNumber, ownerId });
      setRows(result.rows.map((row, index) => ({ id: String(row.id || index), ...row })));
    } catch (error) {
      toast.error("Unable to load report", publicMasterError(error));
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { key: "reviewNumber", header: "Review" },
    { key: "documentNumber", header: "Document" },
    { key: "deviationNumber", header: "Deviation" },
    { key: "capaNumber", header: "CAPA" },
    { key: "changeNumber", header: "Change" },
    { key: "certificateNumber", header: "Certificate" },
    { key: "batchNumber", header: "Batch" },
    { key: "productId", header: "Product" },
    { key: "customerId", header: "Customer" },
    { key: "status", header: "Status" },
    { key: "decision", header: "Decision" },
    { key: "severity", header: "Severity" },
  ];

  return (
    <div>
      <PageHeader
        title="QA reports"
        description="Release, hold, rejection, deviation, CAPA, change control, OOS/OOT, and TAT reports query Firestore."
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
            {qaReportOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="min-h-11" placeholder="Status" value={status} onChange={(event) => setStatus(event.target.value)} />
        <Input className="min-h-11" placeholder="Product ID" value={productId} onChange={(event) => setProductId(event.target.value)} />
        <Input className="min-h-11" placeholder="Customer ID" value={customerId} onChange={(event) => setCustomerId(event.target.value)} />
        <Input className="min-h-11" placeholder="Batch" value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} />
        <Input className="min-h-11" placeholder="QA user / owner ID" value={ownerId} onChange={(event) => setOwnerId(event.target.value)} />
        <Button className="min-h-11" onClick={() => void run()}>Run report</Button>
      </div>
      <DataTable
        columns={columns}
        data={rows.map((row) => ({ ...row, id: String(row.id) }))}
        loading={loading}
        searchable={false}
        paginate={false}
        emptyTitle="No QA report rows"
      />
    </div>
  );
}
