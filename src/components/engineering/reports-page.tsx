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
import { getEngineeringReport } from "@/lib/engineering/client";
import { reportTypeOptions } from "@/lib/engineering/catalog";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";

export function EngineeringReportsPage({ defaultType = "equipment_register" }: { defaultType?: string }) {
  return (
    <RequirePermission permission="engineeringReports:read">
      <Inner defaultType={defaultType} />
    </RequirePermission>
  );
}

function Inner({ defaultType }: { defaultType: string }) {
  const [type, setType] = useState(defaultType);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [meta, setMeta] = useState<Record<string, unknown> | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      void getEngineeringReport(type, { from, to, facilityId, equipmentId })
        .then((result) => {
          setRows(result.rows);
          setMeta(result.meta);
          setError(null);
        })
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [type, from, to, facilityId, equipmentId]);

  const columns = rows[0] ? Object.keys(rows[0]).slice(0, 14) : [];

  return (
    <div>
      <PageHeader
        title="Engineering reports"
        description="Registers, compliance, downtime, and maintenance cost analytics from live records."
        actions={
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              const exportColumns = rows[0] ? Object.keys(rows[0]) : [];
              downloadCsv(`${type}.csv`, recordsToCsv(rows, exportColumns));
              toast.success("Report exported");
            }}
          >
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="min-h-11 md:col-span-2">
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
        <Input className="min-h-11" placeholder="Facility ID" value={facilityId} onChange={(e) => setFacilityId(e.target.value)} />
        <Input
          className="min-h-11 md:col-span-2"
          placeholder="Equipment ID"
          value={equipmentId}
          onChange={(e) => setEquipmentId(e.target.value)}
        />
      </div>
      {meta?.note ? <p className="mb-3 text-sm text-muted-foreground">{String(meta.note)}</p> : null}
      {loading ? <LoadingState /> : null}
      {error ? <EmptyState title="Unable to load report" description={error} /> : null}
      {!loading && !error && !rows.length ? (
        <EmptyState title="No rows" description="No engineering records match the selected filters." />
      ) : null}
      {!loading && rows.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {columns.map((key) => (
                  <th key={key} className="px-4 py-2 font-medium">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row.id || index)} className="border-b last:border-0">
                  {columns.map((key) => (
                    <td key={key} className="px-4 py-2">
                      {formatCell(row[key])}
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

function formatCell(value: unknown) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
