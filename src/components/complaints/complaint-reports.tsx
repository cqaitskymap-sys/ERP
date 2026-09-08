"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getComplaintReport } from "@/lib/complaints/client";
import { reportTypeOptions } from "@/lib/complaints/catalog";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function ComplaintReportsPage() {
  return (
    <RequirePermission permission="complaintReports:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [type, setType] = useState("register");
  const [status, setStatus] = useState("");
  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [marketId, setMarketId] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id?: string }>>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const result = await getComplaintReport(type, { status, productId, customerId, batchNumber, marketId });
      setRows(result.rows.map((row, index) => ({ id: String(row.id || index), ...row })));
    } catch (error) {
      toast.error("Unable to load report", publicMasterError(error));
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { key: "complaintNumber", header: "Complaint" },
    { key: "investigationNumber", header: "Investigation" },
    { key: "recallNumber", header: "Recall" },
    { key: "withdrawalNumber", header: "Withdrawal" },
    { key: "notificationNumber", header: "Notification" },
    { key: "productId", header: "Product" },
    { key: "batchNumber", header: "Batch" },
    { key: "customerId", header: "Customer" },
    { key: "category", header: "Category" },
    { key: "severity", header: "Severity" },
    { key: "status", header: "Status" },
    { key: "dueDate", header: "Due" },
  ];

  return (
    <div>
      <PageHeader
        title="Complaint reports"
        description="Register, trend, recall, and TAT reports query Firestore. Export uses the existing CSV architecture."
        actions={<Button variant="outline" className="min-h-11" onClick={() => downloadCsv(`${type}.csv`, recordsToCsv(rows, columns.map((column) => column.key)))}>Export CSV</Button>}
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{reportTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="min-h-11" placeholder="Status" value={status} onChange={(event) => setStatus(event.target.value)} />
        <Input className="min-h-11" placeholder="Product ID" value={productId} onChange={(event) => setProductId(event.target.value)} />
        <Input className="min-h-11" placeholder="Customer ID" value={customerId} onChange={(event) => setCustomerId(event.target.value)} />
        <Input className="min-h-11" placeholder="Batch" value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} />
        <Input className="min-h-11" placeholder="Market ID" value={marketId} onChange={(event) => setMarketId(event.target.value)} />
        <Button className="min-h-11" disabled={loading} onClick={() => void run()}>Run report</Button>
      </div>
      <DataTable columns={columns} data={rows} loading={loading} searchable={false} paginate emptyTitle="Run a report to load rows." />
    </div>
  );
}
