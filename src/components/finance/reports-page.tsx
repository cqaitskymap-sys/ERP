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
import { getFinanceReport } from "@/lib/finance/client";
import { reportTypeOptions } from "@/lib/finance/catalog";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function FinanceReportsPage({ defaultType = "general_ledger" }: { defaultType?: string }) {
  return (
    <RequirePermission permission={"financeReports:read" as import("@/types/permissions").Permission}>
      <Inner key={defaultType} defaultType={defaultType} />
    </RequirePermission>
  );
}

function Inner({ defaultType }: { defaultType: string }) {
  const [type, setType] = useState(defaultType);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      void getFinanceReport(type, { from, to, periodId })
        .then((result) => {
          setRows(result.rows);
          setError(null);
        })
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [type, from, to, periodId]);

  return (
    <div>
      <PageHeader
        title="Finance reports"
        description="Ledger, trial balance, aging, and statutory registers from posted finance data."
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
        <Input className="min-h-11" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input className="min-h-11" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Input className="min-h-11" placeholder="Period ID" value={periodId} onChange={(e) => setPeriodId(e.target.value)} />
      </div>
      {loading ? <LoadingState /> : null}
      {error ? <EmptyState title="Unable to load report" description={error} /> : null}
      {!loading && !error && !rows.length ? (
        <EmptyState title="No rows" description="No finance records match the selected filters." />
      ) : null}
      {!loading && rows.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {Object.keys(rows[0]).slice(0, 10).map((key) => (
                  <th key={key} className="px-4 py-2 font-medium">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row.id || index)} className="border-b last:border-0">
                  {Object.keys(rows[0]).slice(0, 10).map((key) => (
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
