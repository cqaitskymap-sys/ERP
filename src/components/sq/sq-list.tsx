"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { listSq } from "@/lib/supplier-quality/client";
import { publicMasterError } from "@/lib/masters/errors";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { toast } from "@/lib/feedback/toast";
import type { Permission } from "@/types/permissions";

type Row = Record<string, unknown> & { id: string };

export function SqList({
  title,
  description,
  resource,
  permission,
  createHref,
  createLabel,
  exportColumns,
  columns,
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
  filterValues?: Record<string, string>;
  rowHref: (row: Row) => string;
}) {
  return (
    <RequirePermission permission={permission}>
      <Inner title={title} description={description} resource={resource} createHref={createHref} createLabel={createLabel} exportColumns={exportColumns} columns={columns} filterValues={filterValues} rowHref={rowHref} />
    </RequirePermission>
  );
}

function Inner({ title, description, resource, createHref, createLabel, exportColumns, columns, filterValues, rowHref }: {
  title: string; description: string; resource: string; createHref?: string; createLabel?: string; exportColumns: string[]; columns: DataTableColumn<Row>[]; filterValues: Record<string, string>; rowHref: (row: Row) => string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const filterKey = JSON.stringify(filterValues);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLoading(true);
      void listSq(resource, { ...filterValues, search: debounced, pageSize: 25 })
        .then((result) => { setRows(result.rows); setCursor(result.nextCursor); })
        .catch((error) => toast.error("Unable to load records", publicMasterError(error)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resource, debounced, filterKey, filterValues]);

  return (
    <div>
      <PageHeader title={title} description={description} actions={
        <>
          <Button variant="outline" className="min-h-11" onClick={() => downloadCsv(`${resource}.csv`, recordsToCsv(rows, exportColumns))}><Download className="size-4" />Export</Button>
          {createHref ? <Button className="min-h-11" onClick={() => router.push(createHref)}><Plus className="size-4" />{createLabel || "Create"}</Button> : null}
        </>
      } />
      <Input className="mb-4 min-h-11 lg:max-w-sm" placeholder="Search supplier, number, or material" value={search} onChange={(event) => setSearch(event.target.value)} />
      <DataTable columns={columns} data={rows} loading={loading} searchable={false} paginate={false} onRowClick={(row) => router.push(rowHref(row))} emptyTitle="No supplier-quality records" />
      {cursor ? <Button variant="outline" className="mt-4 min-h-11" onClick={() => void listSq(resource, { ...filterValues, search: debounced, pageSize: 25, cursor }).then((result) => { setRows((current) => [...current, ...result.rows]); setCursor(result.nextCursor); })}>Load more</Button> : null}
    </div>
  );
}
