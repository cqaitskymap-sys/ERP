"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDmsReport } from "@/lib/dms/client";
import { reportTypeOptions } from "@/lib/dms/catalog";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function DmsReportsPage() {
  return (
    <RequirePermission permission="dmsReports:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [type, setType] = useState("registry");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      void getDmsReport(type, { from, to, departmentId })
        .then((result) => {
          setRows(result.rows);
          setError(null);
        })
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [type, from, to, departmentId]);

  const columns = rows[0] ? Object.keys(rows[0]).filter((key) => key !== "id").slice(0, 12) : [];

  return (
    <div>
      <PageHeader
        title="Document control reports"
        description="Exports use the rows returned from Firestore for the selected report. Counts are not hard-coded."
        actions={
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              downloadCsv(`${type}.csv`, recordsToCsv(rows, rows[0] ? Object.keys(rows[0]) : []));
              toast.success("Report exported");
            }}
          >
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {reportTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="min-h-11" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <Input className="min-h-11" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <Input className="min-h-11" placeholder="Department ID" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} />
      </div>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      {loading ? <LoadingState /> : null}
      {!loading && !rows.length ? <p className="text-sm text-muted-foreground">No rows for this report.</p> : null}
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-3 py-2 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row.id || index)} className="border-t">
                  {columns.map((column) => (
                    <td key={column} className="px-3 py-2">
                      {String(row[column] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
