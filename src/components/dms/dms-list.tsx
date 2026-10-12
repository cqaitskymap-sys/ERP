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
import { listDms } from "@/lib/dms/client";
import { publicMasterError } from "@/lib/masters/errors";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

export function DmsList({
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

function ListInner(props: {
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
  const filterKey = Object.entries(props.filterValues || {})
    .map(([key, value]) => `${key}:${value}`)
    .join("|");

  useEffect(() => {
    let ignore = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void listDms(props.resource, { ...props.filterValues, search: debounced, pageSize: 50 })
        .then((result) => {
          if (ignore) return;
          setRows(result.rows);
          setError(null);
        })
        .catch((err) => {
          if (!ignore) setError(publicMasterError(err));
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }, 0);
    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
    // filterKey serializes filterValues for stable effect deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.resource, debounced, filterKey]);

  return (
    <div>
      <PageHeader
        title={props.title}
        description={props.description}
        actions={
          <>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                downloadCsv(`${props.resource}.csv`, recordsToCsv(rows, props.exportColumns));
                toast.success("Export ready");
              }}
            >
              <Download className="mr-2 size-4" />
              Export
            </Button>
            {props.createHref ? (
              <Button asChild className="min-h-11">
                <a href={props.createHref}>
                  <Plus className="mr-2 size-4" />
                  {props.createLabel || "Create"}
                </a>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end">
        <Input
          className="min-h-11 md:max-w-sm"
          placeholder="Search number or title"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {props.filters}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Search matches the start of the number, title, or department. It is not unrestricted full-text search.
      </p>
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      <DataTable
        columns={props.columns}
        data={rows}
        loading={loading}
        emptyTitle="No records yet"
        emptyDescription="Create a record or adjust the filters."
        onRowClick={(row) => router.push(props.rowHref(row))}
      />
    </div>
  );
}
