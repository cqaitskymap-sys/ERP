"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getPvReport } from "@/lib/pv/client";
import { pvReportOptions } from "@/lib/pv/catalog";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function PvReportsPage() {
  return (
    <RequirePermission permission="pvReports:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [type, setType] = useState("safety_case");
  const [status, setStatus] = useState("");
  const [productId, setProductId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [marketId, setMarketId] = useState("");
  const [country, setCountry] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id?: string }>>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const result = await getPvReport(type, { status, productId, customerId, batchNumber, marketId, country });
      setRows(result.rows.map((row, index) => ({ id: String(row.id || index), ...row })));
    } catch (error) {
      toast.error("Unable to load report", publicMasterError(error));
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { key: "caseNumber", header: "Case" },
    { key: "intakeNumber", header: "Intake" },
    { key: "followUpNumber", header: "Follow-up" },
    { key: "reportNumber", header: "Report" },
    { key: "signalNumber", header: "Signal" },
    { key: "productId", header: "Product" },
    { key: "batchNumber", header: "Batch" },
    { key: "eventTerm", header: "Event" },
    { key: "status", header: "Status" },
    { key: "dueDate", header: "Due" },
  ];

  return (
    <div>
      <PageHeader
        title="PV reports"
        description="Safety case, follow-up, signal, and TAT reports query Firestore. Patient identifiers are redacted from case lists."
        actions={<Button variant="outline" className="min-h-11" onClick={() => downloadCsv(`${type}.csv`, recordsToCsv(rows, columns.map((column) => column.key)))}>Export CSV</Button>}
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{pvReportOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="min-h-11" placeholder="Status" value={status} onChange={(event) => setStatus(event.target.value)} />
        <Input className="min-h-11" placeholder="Product ID" value={productId} onChange={(event) => setProductId(event.target.value)} />
        <Input className="min-h-11" placeholder="Customer ID" value={customerId} onChange={(event) => setCustomerId(event.target.value)} />
        <Input className="min-h-11" placeholder="Batch" value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} />
        <Input className="min-h-11" placeholder="Market ID" value={marketId} onChange={(event) => setMarketId(event.target.value)} />
        <Input className="min-h-11" placeholder="Country" value={country} onChange={(event) => setCountry(event.target.value)} />
        <Button className="min-h-11" disabled={loading} onClick={() => void run()}>Run report</Button>
      </div>
      <DataTable columns={columns} data={rows} loading={loading} searchable={false} paginate emptyTitle="Run a report to load rows." />
    </div>
  );
}
