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
import { listProcurement } from "@/lib/procurement/client";
import { publicMasterError } from "@/lib/masters/errors";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

export function ProcurementList({
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
  filterValues: Record<string, string>;
  rowHref: (row: Row) => string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const filterKey = JSON.stringify(filterValues);

  useEffect(() => {
    let ignore = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void listProcurement(resource, { ...filterValues, search: debounced, pageSize: 25 })
        .then((result) => {
          if (!ignore) setRows(result.rows);
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
        onRowClick={(row) => router.push(rowHref(row))}
        emptyTitle="No procurement records"
      />
    </div>
  );
}
