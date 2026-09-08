"use client";

import { useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSqReport } from "@/lib/supplier-quality/client";
import { reportTypeOptions } from "@/lib/supplier-quality/catalog";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function SqReportsPage() {
  return (
    <RequirePermission permission="supplierQualityReports:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [type, setType] = useState("approved_list");
  const [status, setStatus] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown> & { id?: string }>>([]);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const result = await getSqReport(type, { status, supplierId, materialId, riskLevel });
      setRows(result.rows.map((row, index) => ({ id: String(row.id || index), ...row })));
    } catch (error) {
      toast.error("Unable to load report", publicMasterError(error));
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { key: "qualificationNumber", header: "Qualification" },
    { key: "auditNumber", header: "Audit" },
    { key: "supplierId", header: "Supplier" },
    { key: "materialId", header: "Material" },
    { key: "riskLevel", header: "Risk" },
    { key: "qualificationStatus", header: "Material status" },
    { key: "status", header: "Status" },
    { key: "overallScore", header: "Score" },
    { key: "expiryDate", header: "Expiry" },
    { key: "dueDate", header: "Due" },
  ];

  return (
    <div>
      <PageHeader
        title="Supplier quality reports"
        description="Approved supplier, qualification, audit, certificate, and performance reports query Firestore."
        actions={<Button variant="outline" className="min-h-11" onClick={() => downloadCsv(`${type}.csv`, recordsToCsv(rows, columns.map((column) => column.key)))}>Export CSV</Button>}
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>{reportTypeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input className="min-h-11" placeholder="Status" value={status} onChange={(event) => setStatus(event.target.value)} />
        <Input className="min-h-11" placeholder="Supplier ID" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} />
        <Input className="min-h-11" placeholder="Material ID" value={materialId} onChange={(event) => setMaterialId(event.target.value)} />
        <Input className="min-h-11" placeholder="Risk" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)} />
        <Button className="min-h-11" disabled={loading} onClick={() => void run()}>Run report</Button>
      </div>
      <DataTable columns={columns} data={rows} loading={loading} searchable={false} paginate emptyTitle="Run a report to load rows." />
    </div>
  );
}
