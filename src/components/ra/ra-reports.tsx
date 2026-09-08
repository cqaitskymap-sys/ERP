"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getRaReport } from "@/lib/ra/client";
import { raReportOptions } from "@/lib/ra/catalog";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function RaReportsPage() {
  return (
    <RequirePermission permission="raReports:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [type, setType] = useState("registration");
  const [status, setStatus] = useState("");
  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [marketId, setMarketId] = useState("");
  const [authorityId, setAuthorityId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id?: string }>>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const result = await getRaReport(type, { status, productId, customerId, marketId, authorityId, ownerId });
      setRows(result.rows.map((row, index) => ({ id: String(row.id || index), ...row })));
    } catch (error) {
      toast.error("Unable to load report", publicMasterError(error));
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { key: "registrationNumber", header: "Registration" },
    { key: "submissionNumber", header: "Submission" },
    { key: "licenseNumber", header: "License" },
    { key: "queryNumber", header: "Query" },
    { key: "commitmentNumber", header: "Commitment" },
    { key: "title", header: "Title" },
    { key: "productId", header: "Product" },
    { key: "marketId", header: "Market" },
    { key: "authorityId", header: "Authority" },
    { key: "status", header: "Status" },
    { key: "expiryDate", header: "Expiry" },
    { key: "dueDate", header: "Due" },
  ];

  return (
    <div>
      <PageHeader
        title="RA reports"
        description="Registration, expiry, query, commitment, and calendar reports query Firestore."
        actions={<Button variant="outline" className="min-h-11" onClick={() => downloadCsv(`${type}.csv`, recordsToCsv(rows, columns.map((column) => column.key)))}>Export CSV</Button>}
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{raReportOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="min-h-11" placeholder="Status" value={status} onChange={(event) => setStatus(event.target.value)} />
        <Input className="min-h-11" placeholder="Product ID" value={productId} onChange={(event) => setProductId(event.target.value)} />
        <Input className="min-h-11" placeholder="Customer ID" value={customerId} onChange={(event) => setCustomerId(event.target.value)} />
        <Input className="min-h-11" placeholder="Market ID" value={marketId} onChange={(event) => setMarketId(event.target.value)} />
        <Input className="min-h-11" placeholder="Authority ID" value={authorityId} onChange={(event) => setAuthorityId(event.target.value)} />
        <Input className="min-h-11" placeholder="Owner ID" value={ownerId} onChange={(event) => setOwnerId(event.target.value)} />
        <Button className="min-h-11" onClick={() => void run()}>Run report</Button>
      </div>
      <DataTable columns={columns} data={rows.map((row) => ({ ...row, id: String(row.id) }))} loading={loading} searchable={false} paginate={false} emptyTitle="No RA report rows" />
    </div>
  );
}
