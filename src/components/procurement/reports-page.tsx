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
import { getProcurementReport } from "@/lib/procurement/client";
import { procurementReportOptions } from "@/lib/procurement/catalog";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function ProcurementReportsPage() {
  return (
    <RequirePermission permission="procurement:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [type, setType] = useState("purchase_order");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id?: string }>>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const result = await getProcurementReport(type, { status, from, to });
      setRows(result.rows.map((row, index) => ({ id: String(row.id || index), ...row })));
    } catch (error) {
      toast.error("Unable to load report", publicMasterError(error));
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { key: "poNumber", header: "Number" },
    { key: "requisitionNumber", header: "PR" },
    { key: "rfqNumber", header: "RFQ" },
    { key: "quotationNumber", header: "Quotation" },
    { key: "vendorId", header: "Vendor" },
    { key: "status", header: "Status" },
    { key: "grandTotal", header: "Value" },
    { key: "expectedDeliveryDate", header: "Delivery" },
    { key: "daysOverdue", header: "Overdue" },
  ];

  return (
    <div>
      <PageHeader
        title="Procurement reports"
        description="Date, vendor, plant, and status filters query Firestore with pagination. Export uses the current result set."
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
      <div className="mb-4 grid gap-3 md:grid-cols-5">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {procurementReportOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="min-h-11" placeholder="Status" value={status} onChange={(event) => setStatus(event.target.value)} />
        <Input className="min-h-11" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <Input className="min-h-11" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <Button className="min-h-11" onClick={() => void run()}>Run report</Button>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        searchable={false}
        paginate={false}
        emptyTitle="No report rows"
        getRowId={(row) => String(row.id || row.poNumber || Math.random())}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Print/PDF uses the browser print dialog on this page. Excel-compatible CSV is available from Export.
      </p>
    </div>
  );
}
