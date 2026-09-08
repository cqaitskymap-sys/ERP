"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  accessor?: keyof T;
  className?: string;
  sortable?: boolean;
  hideOnMobile?: boolean;
  cell?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  paginate?: boolean;
  onRowClick?: (row: T) => void;
  toolbar?: ReactNode;
  footer?: ReactNode;
  getRowId?: (row: T, index: number) => string;
}

export function DataTable<T extends object>({
  columns,
  data,
  loading = false,
  searchable = true,
  searchPlaceholder = "Search records",
  emptyTitle = "No records yet",
  emptyDescription = "When this module starts writing data, it will appear here.",
  pageSize = 8,
  paginate = true,
  onRowClick,
  toolbar,
  footer,
  getRowId,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const debouncedSearch = useDebounce(search, 200);

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let rows = data;

    if (query) {
      rows = data.filter((row) =>
        Object.values(row).some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query)
        )
      );
    }

    if (!sortKey) return rows;

    return [...rows].sort((a, b) => {
      const left = String((a as Record<string, unknown>)[sortKey] ?? "");
      const right = String((b as Record<string, unknown>)[sortKey] ?? "");
      const result = left.localeCompare(right, undefined, { numeric: true });
      return sortDirection === "asc" ? result : -result;
    });
  }, [data, debouncedSearch, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = paginate
    ? filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : filtered;

  function toggleSort(column: DataTableColumn<T>) {
    if (!column.sortable) return;
    const key = String(column.accessor ?? column.key);
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {searchable ? (
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              className="pl-8"
            />
          </div>
        ) : (
          <div />
        )}
        {toolbar}
      </div>

      {loading ? (
        <div className="p-4">
          <LoadingState variant="table" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-4">
          <EmptyState
            compact
            title={emptyTitle}
            description={emptyDescription}
          />
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => {
                  const active = sortKey === String(column.accessor ?? column.key);
                  return (
                    <TableHead
                      key={column.key}
                      className={cn(
                        column.hideOnMobile && "hidden md:table-cell",
                        column.className
                      )}
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column)}
                          className="inline-flex items-center gap-1 text-left"
                        >
                          {column.header}
                          {active ? (
                            sortDirection === "asc" ? (
                              <ArrowUp className="size-3.5" />
                            ) : (
                              <ArrowDown className="size-3.5" />
                            )
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        column.header
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row, index) => (
                <TableRow
                  key={getRowId?.(row, index) ?? String(index)}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        column.hideOnMobile && "hidden md:table-cell",
                        column.className
                      )}
                    >
                      {column.cell
                        ? column.cell(row)
                        : column.accessor
                          ? String(row[column.accessor] ?? "—")
                          : "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            {footer ?? (
              <>
                <p>
                  {filtered.length} record{filtered.length === 1 ? "" : "s"}
                </p>
                {paginate ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                      Previous
                    </Button>
                    <span>
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
