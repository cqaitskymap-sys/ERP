"use client";

import { useEffect, useState } from "react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSalesReport } from "@/lib/sales/client";
import { reportTypeOptions } from "@/lib/sales/catalog";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function SalesReportsPage() {
  return (
    <RequirePermission permission="salesReports:read">
      <Inner />
    </RequirePermission>
  );
}

function Inner() {
  const [type, setType] = useState("sales_order_register");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      void getSalesReport(type, { from, to, customerId })
        .then((result) => {
          setRows(result.rows);
          setError(null);
        })
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [type, from, to, customerId]);

  return (
    <div>
      <PageHeader
        title="Sales reports"
        description="Reports reflect actual sales source records. Sensitive fields respect pricing RBAC."
        actions={
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              const columns = rows[0] ? Object.keys(rows[0]) : [];
              downloadCsv(`${type}.csv`, recordsToCsv(rows, columns));
              toast.success("Report exported");
            }}
          >
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {reportTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="min-h-11" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input className="min-h-11" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Input className="min-h-11" placeholder="Customer ID" value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
      </div>
      {loading ? <LoadingState /> : null}
      {error ? <EmptyState title="Unable to load report" description={error} /> : null}
      {!loading && !error && !rows.length ? (
        <EmptyState title="No rows" description="No source records match the selected filters." />
      ) : null}
      {!loading && rows.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {Object.keys(rows[0]).slice(0, 8).map((key) => (
                  <th key={key} className="px-4 py-2 font-medium">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row.id || index)} className="border-b last:border-0">
                  {Object.keys(rows[0]).slice(0, 8).map((key) => (
                    <td key={key} className="px-4 py-2">
                      {String(row[key] ?? "—")}
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
