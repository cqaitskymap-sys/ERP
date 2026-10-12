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
import { listWarehouse } from "@/lib/inventory/client";
import { publicMasterError } from "@/lib/masters/errors";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

export function WarehouseList({
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
  emptyTitle,
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
  emptyTitle?: string;
}) {
  return (
    <RequirePermission permission={permission}>
      <WarehouseListInner
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
        emptyTitle={emptyTitle}
      />
    </RequirePermission>
  );
}

function WarehouseListInner({
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
  emptyTitle,
}: {
  title: string;
  description: string;
  resource: string;
  createHref?: string;
  createLabel?: string;
  exportColumns: string[];
  columns: DataTableColumn<Row>[];
  filters?: ReactNode;
  filterValues: Record<string, string>;
  rowHref: (row: Row) => string;
  emptyTitle?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const filterKey = JSON.stringify(filterValues);

  useEffect(() => {
    let ignore = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void listWarehouse(resource, { ...filterValues, search: debounced, pageSize: 25 })
        .then((result) => {
          if (ignore) return;
          setRows(result.rows);
          setCursor(result.nextCursor);
        })
        .catch((error) => {
          if (!ignore) toast.error("Unable to load records", publicMasterError(error));
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }, 0);
    return () => {
      ignore = true;
      window.clearTimeout(timer);
    };
  }, [resource, debounced, filterKey, filterValues]);

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
              onClick={() => downloadCsv(`${resource}.csv`, recordsToCsv(rows, exportColumns))}
            >
              <Download className="size-4" />
              Export
            </Button>
            {createHref ? (
              <Button className="min-h-11" onClick={() => router.push(createHref)}>
                <Plus className="size-4" />
                {createLabel || "Create"}
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <Input
          className="min-h-11 lg:max-w-sm"
          placeholder="Search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {filters}
      </div>
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        searchable={false}
        paginate={false}
        emptyTitle={emptyTitle || "No records yet"}
        emptyDescription="Warehouse transactions will appear here after the first posting."
        onRowClick={(row) => router.push(rowHref(row))}
        getRowId={(row) => row.id}
        footer={
          cursor ? (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                void listWarehouse(resource, { ...filterValues, search: debounced, cursor, pageSize: 25 }).then(
                  (result) => {
                    setRows((current) => [...current, ...result.rows]);
                    setCursor(result.nextCursor);
                  }
                );
              }}
            >
              Load more
            </Button>
          ) : null
        }
      />
    </div>
  );
}
