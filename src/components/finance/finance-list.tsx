"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { listFinance } from "@/lib/finance/client";
import { publicMasterError } from "@/lib/masters/errors";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

export function FinanceList({
  title,
  description,
  resource,
  permission,
  createHref,
  createLabel,
  exportColumns,
  columns,
  filters,
  filterValues = {},
  rowHref,
}: {
  title: string;
  description: string;
  resource: string;
  permission: Permission;
  createHref?: string;
  createLabel?: string;
  exportColumns: string[];
  columns: DataTableColumn<Row>[];
  filters?: ReactNode;
  filterValues?: Record<string, string>;
  rowHref: (row: Row) => string;
}) {
  return (
    <RequirePermission permission={permission}>
      <ListInner
        title={title}
        description={description}
        resource={resource}
        createHref={createHref}
        createLabel={createLabel}
        exportColumns={exportColumns}
        columns={columns}
        filters={filters}
        filterValues={filterValues}
        rowHref={rowHref}
      />
    </RequirePermission>
  );
}

function ListInner({
  title,
  description,
  resource,
  createHref,
  createLabel,
  exportColumns,
  columns,
  filters,
  filterValues,
  rowHref,
}: {
  title: string;
  description: string;
  resource: string;
  createHref?: string;
  createLabel?: string;
  exportColumns: string[];
  columns: DataTableColumn<Row>[];
  filters?: ReactNode;
  filterValues?: Record<string, string>;
  rowHref: (row: Row) => string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const filterKey = Object.entries(filterValues || {})
    .map(([key, value]) => `${key}:${value}`)
    .join("|");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      void listFinance(resource, { ...filterValues, search: debounced, pageSize: 50 })
        .then((result) => {
          setRows(result.rows);
          setError(null);
        })
        .catch((err) => setError(publicMasterError(err)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
    // filterKey serializes filterValues for stable effect deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, debounced, filterKey]);

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                downloadCsv(`${resource}.csv`, recordsToCsv(rows, exportColumns));
                toast.success("Export ready");
              }}
            >
              <Download className="mr-2 size-4" />
              Export
            </Button>
            {createHref ? (
              <Button asChild className="min-h-11">
                <a href={createHref}>
                  <Plus className="mr-2 size-4" />
                  {createLabel || "Create"}
                </a>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end">
        <Input
          className="min-h-11 md:max-w-sm"
          placeholder="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {filters}
      </div>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        emptyTitle="No records yet"
        emptyDescription="Create a record or adjust filters."
        onRowClick={(row) => router.push(rowHref(row))}
      />
    </div>
  );
}
