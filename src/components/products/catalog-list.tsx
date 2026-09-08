"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, MoreHorizontal, Plus } from "lucide-react";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/tables/data-table";
import { StatusBadge } from "@/components/feedback/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/hooks/use-confirm";
import { useDebounce } from "@/hooks/use-debounce";
import { useMasterList } from "@/hooks/use-masters";
import { listMasterRecords, setMasterRecordStatus } from "@/lib/masters/client";
import { publicMasterError } from "@/lib/masters/errors";
import { getMasterDefinition } from "@/lib/masters/registry";
import { downloadCsv, recordsToCsv } from "@/lib/products/export";
import { toast } from "@/lib/feedback/toast";
import type { MasterEntity } from "@/types/masters";
import type { Permission } from "@/types/permissions";

const ALL = "__all__";

interface CatalogListProps {
  entity: "products" | "materials" | "customers" | "vendors";
  title: string;
  description: string;
  permission: Permission;
  writePermission: Permission;
  exportPermission: Permission;
  detailHref: (id: string) => string;
  createHref: string;
  columns: Array<{ key: string; header: string; hideOnMobile?: boolean }>;
  filters: Array<{
    key: string;
    label: string;
    options?: Array<{ label: string; value: string }>;
    relation?: MasterEntity;
  }>;
  statusOptions: Array<{ label: string; value: string }>;
  exportColumns: string[];
  editPermission: Permission;
  deactivatePermission: Permission;
  recordActions: Array<{ label: string; tab: string; permission?: Permission }>;
}

export function CatalogList(props: CatalogListProps) {
  return (
    <RequirePermission permission={props.permission}>
      <CatalogListInner {...props} />
    </RequirePermission>
  );
}

function CatalogListInner({
  entity,
  title,
  description,
  writePermission,
  exportPermission,
  editPermission,
  deactivatePermission,
  recordActions,
  detailHref,
  createHref,
  columns,
  filters,
  statusOptions,
  exportColumns,
}: CatalogListProps) {
  const router = useRouter();
  const { can } = useAuth();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([undefined]);
  const debouncedSearch = useDebounce(search, 300);
  const query = {
    status: status === ALL ? "all" : status,
    search: debouncedSearch || undefined,
    pageSize: 15,
    cursor: cursorStack[cursorStack.length - 1],
    productType: extra.productType === ALL ? undefined : extra.productType,
    dosageForm: extra.dosageForm === ALL ? undefined : extra.dosageForm,
    materialType: extra.materialType === ALL ? undefined : extra.materialType,
    uom: extra.uom === ALL ? undefined : extra.uom,
    supplierId: extra.supplierId === ALL ? undefined : extra.supplierId,
    customerType: extra.customerType === ALL ? undefined : extra.customerType,
    vendorType: extra.vendorType === ALL ? undefined : extra.vendorType,
    qualificationStatus: extra.qualificationStatus === ALL ? undefined : extra.qualificationStatus,
    riskCategory: extra.riskCategory === ALL ? undefined : extra.riskCategory,
    country: extra.country?.trim() || undefined,
    materialId: extra.materialId === ALL ? undefined : extra.materialId,
  };
  const { rows, nextCursor, loading, error, reload } = useMasterList(entity, query);
  const [relationOptions, setRelationOptions] = useState<
    Record<string, Array<{ label: string; value: string }>>
  >({});

  const relationKey = filters
    .map((filter) => `${filter.key}:${filter.relation || ""}`)
    .join("|");

  useEffect(() => {
    const relationFilters = filters.filter((filter) => filter.relation);
    if (!relationFilters.length) return;
    const timer = window.setTimeout(() => {
      void Promise.all(
        relationFilters.map(async (filter) => {
          const definition = getMasterDefinition(filter.relation!);
          const result = await listMasterRecords(filter.relation!, {
            status: "active",
            pageSize: 100,
          }).catch(() => ({ rows: [] as Array<Record<string, unknown> & { id: string }> }));
          return [
            filter.key,
            result.rows.map((row) => ({
              value: row.id,
              label: String(
                row[definition?.nameField || "id"] ||
                  row[definition?.codeField || "id"] ||
                  row.id
              ),
            })),
          ] as const;
        })
      ).then((entries) => setRelationOptions(Object.fromEntries(entries)));
    }, 0);
    return () => window.clearTimeout(timer);
    // relationKey is the stable identity of relation-backed filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationKey]);

  async function deactivate(row: Record<string, unknown> & { id: string }) {
    const accepted = await confirm({
      title: "Deactivate this record?",
      description: "The record stays available for history. It cannot be used in new transactions.",
      confirmLabel: "Deactivate",
      variant: "destructive",
    });
    if (!accepted) return;
    try {
      await setMasterRecordStatus(entity, row.id, "inactive");
      toast.success("Record deactivated");
      await reload();
    } catch (err) {
      toast.error("Unable to deactivate", publicMasterError(err));
    }
  }

  async function exportRows() {
    try {
      const result = await listMasterRecords(entity, {
        ...query,
        cursor: undefined,
        pageSize: 200,
      });
      downloadCsv(`${entity}.csv`, recordsToCsv(result.rows, exportColumns));
      toast.success("Export ready");
    } catch (err) {
      toast.error("Export failed", publicMasterError(err));
    }
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {can(exportPermission) ? (
              <Button variant="outline" onClick={() => void exportRows()}>
                <Download className="size-4" />
                Export CSV
              </Button>
            ) : null}
            {can(writePermission) ? (
              <Button onClick={() => router.push(createHref)}>
                <Plus className="size-4" />
                New record
              </Button>
            ) : null}
          </>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input
          value={search}
          placeholder="Search code or name"
          onChange={(event) => {
            setSearch(event.target.value);
            setCursorStack([undefined]);
          }}
        />
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setCursorStack([undefined]);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filters.map((filter) =>
          filter.key === "country" && !filter.options && !filter.relation ? (
            <Input
              key={filter.key}
              value={extra.country || ""}
              placeholder="Country"
              onChange={(event) => {
                setExtra((current) => ({ ...current, country: event.target.value }));
                setCursorStack([undefined]);
              }}
            />
          ) : (
          <Select
            key={filter.key}
            value={extra[filter.key] || ALL}
            onValueChange={(value) => {
              setExtra((current) => ({ ...current, [filter.key]: value }));
              setCursorStack([undefined]);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All {filter.label.toLowerCase()}</SelectItem>
              {(filter.options || relationOptions[filter.key] || []).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          )
        )}
      </div>
      {error ? (
        <EmptyState title="Unable to load records" description={error} />
      ) : (
        <DataTable
          searchable={false}
          paginate={false}
          loading={loading}
          data={rows}
          emptyTitle={`No ${title.toLowerCase()} yet`}
          emptyDescription="Create the first record. Historical statuses remain searchable after deactivation."
          getRowId={(row) => row.id}
          onRowClick={(row) => router.push(detailHref(row.id))}
          columns={[
            ...columns.map((column) => ({
              key: column.key,
              header: column.header,
              accessor: column.key,
              sortable: true,
              hideOnMobile: column.hideOnMobile,
              cell: (row: Record<string, unknown>) =>
                column.key === "status" ? (
                  <StatusBadge
                    label={String(row.status || "")}
                    tone={
                      row.status === "active"
                        ? "success"
                        : row.status === "draft" || row.status === "under_development"
                          ? "info"
                          : "warning"
                    }
                  />
                ) : column.key === "customerLabel" || column.key === "supplierLabel" ? (
                  "Mapped separately"
                ) : (
                  String(row[column.key] ?? "—")
                ),
            })),
            {
              key: "updatedAt",
              header: "Updated",
              hideOnMobile: true,
              cell: (row: Record<string, unknown>) =>
                String(row.updatedAt || "").slice(0, 10) || "—",
            },
            {
              key: "actions",
              header: "Actions",
              cell: (row: Record<string, unknown> & { id: string }) => (
                <div onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" aria-label="Record actions">
                        <MoreHorizontal className="size-4" />
                        Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(detailHref(row.id))}>
                        View
                      </DropdownMenuItem>
                      {can(editPermission) ? (
                        <DropdownMenuItem onClick={() => router.push(`${detailHref(row.id)}/edit`)}>
                          Edit
                        </DropdownMenuItem>
                      ) : null}
                      {recordActions
                        .filter((action) => !action.permission || can(action.permission))
                        .map((action) => (
                          <DropdownMenuItem
                            key={action.tab}
                            onClick={() => router.push(`${detailHref(row.id)}?tab=${action.tab}`)}
                          >
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      {can(deactivatePermission) &&
                      row.status !== "discontinued" &&
                      row.status !== "inactive" ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => void deactivate(row)}
                          >
                            Deactivate
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ),
            },
          ]}
          footer={
            <div className="flex w-full items-center justify-between">
              <p>
                {rows.length} record{rows.length === 1 ? "" : "s"}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cursorStack.length < 2}
                  onClick={() => setCursorStack((stack) => stack.slice(0, -1))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!nextCursor}
                  onClick={() => setCursorStack((stack) => [...stack, nextCursor || undefined])}
                >
                  Next
                </Button>
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
