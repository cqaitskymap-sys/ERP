"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { RequirePermission } from "@/components/auth/require-permission";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { MasterForm } from "@/components/masters/master-form";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/hooks/use-confirm";
import { useDebounce } from "@/hooks/use-debounce";
import { useMasterList } from "@/hooks/use-masters";
import {
  createMasterRecord,
  issueDocumentNumber,
  listMasterRecords,
  setMasterRecordStatus,
  updateMasterRecord,
} from "@/lib/masters/client";
import { publicMasterError } from "@/lib/masters/errors";
import { masterPermission } from "@/lib/masters/permissions";
import { getMasterDefinition } from "@/lib/masters/registry";
import { toast } from "@/lib/feedback/toast";
import type { MasterEntity, MasterStatus } from "@/types/masters";

const ALL = "__all__";

interface MasterPageProps {
  entity: MasterEntity;
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export function MasterPage({ entity, title, description, actions }: MasterPageProps) {
  return (
    <RequirePermission permission={masterPermission(entity, "read")}>
      <MasterWorkspace
        entity={entity}
        title={title}
        description={description}
        actions={actions}
      />
    </RequirePermission>
  );
}

function MasterWorkspace({ entity, title, description, actions }: MasterPageProps) {
  const definition = getMasterDefinition(entity)!;
  const { can } = useAuth();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [companyId, setCompanyId] = useState(ALL);
  const [plantId, setPlantId] = useState(ALL);
  const [warehouseId, setWarehouseId] = useState(ALL);
  const [departmentId, setDepartmentId] = useState(ALL);
  const [cursorStack, setCursorStack] = useState<Array<string | undefined>>([undefined]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit" | "view">("create");
  const [selected, setSelected] = useState<(Record<string, unknown> & { id: string }) | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [filterOptions, setFilterOptions] = useState<
    Record<string, Array<{ value: string; label: string }>>
  >({});
  const debouncedSearch = useDebounce(search, 300);
  const pageCursor = cursorStack[cursorStack.length - 1];
  const filterKeys = definition.filters;

  const query = {
    status,
    search: debouncedSearch || undefined,
    pageSize: 15,
    cursor: pageCursor,
    companyId: companyId === ALL ? undefined : companyId,
    plantId: plantId === ALL ? undefined : plantId,
    warehouseId: warehouseId === ALL ? undefined : warehouseId,
    departmentId: departmentId === ALL ? undefined : departmentId,
  };

  const { rows, nextCursor, loading, error, reload } = useMasterList(entity, query);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const related = Array.from(
        new Set(definition.fields.filter((field) => field.relation).map((field) => field.relation!))
      );
      void Promise.all(
        related.map(async (item) => {
          const result = await listMasterRecords(item, { pageSize: 100 }).catch(() => ({
            rows: [],
          }));
          const def = getMasterDefinition(item);
          return result.rows.map((row) => [
            `${item}:${row.id}`,
            String(row[def?.nameField || "id"] || row[def?.codeField || "id"] || row.id),
          ]);
        })
      ).then((groups) => setLabels(Object.fromEntries(groups.flat())));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [entity, definition.fields]);

  useEffect(() => {
    const map: Record<string, MasterEntity> = {
      companyId: "companies",
      plantId: "plants",
      warehouseId: "warehouses",
      departmentId: "departments",
    };
    const needed = filterKeys
      .map((item) => map[item])
      .filter((item): item is MasterEntity => Boolean(item));
    if (!needed.length) return;

    const timer = window.setTimeout(() => {
      void Promise.all(
        needed.map(async (item) => {
          const result = await listMasterRecords(item, {
            status: "active",
            pageSize: 100,
          }).catch(() => ({ rows: [] }));
          const def = getMasterDefinition(item);
          return [
            item,
            result.rows.map((row) => ({
              value: row.id,
              label: String(row[def?.nameField || "id"] || row[def?.codeField || "id"] || row.id),
            })),
          ] as const;
        })
      ).then((entries) => setFilterOptions(Object.fromEntries(entries)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [entity, filterKeys]);

  const columns: DataTableColumn<Record<string, unknown> & { id: string }>[] =
    definition.columns.map((column) => ({
      key: column.key,
      header: column.header,
      accessor: column.key,
      sortable: true,
      hideOnMobile: column.hideOnMobile,
      cell: (row) => renderCell(column.key, row, labels),
    }));

  function openCreate() {
    setSelected(null);
    setMode("create");
    setOpen(true);
  }

  function openRecord(
    row: Record<string, unknown> & { id: string },
    nextMode: "edit" | "view"
  ) {
    setSelected(row);
    setMode(nextMode);
    setOpen(true);
  }

  async function save(values: Record<string, unknown>) {
    setSubmitting(true);
    try {
      if (selected?.id && mode === "edit") {
        await updateMasterRecord(entity, selected.id, values);
        toast.success("Record updated");
      } else {
        await createMasterRecord(entity, values);
        toast.success("Record created");
      }
      setOpen(false);
      await reload();
    } catch (err) {
      toast.error("Unable to save", publicMasterError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(
    row: Record<string, unknown> & { id: string },
    next: MasterStatus
  ) {
    const accepted = await confirm({
      title: next === "active" ? "Activate record?" : "Deactivate record?",
      description: "This change is audited and will affect future document selection.",
      confirmLabel: next === "active" ? "Activate" : "Deactivate",
      variant: next === "active" ? "default" : "destructive",
    });
    if (!accepted) return;
    try {
      await setMasterRecordStatus(entity, row.id, next);
      toast.success(next === "active" ? "Activated" : "Deactivated");
      await reload();
    } catch (err) {
      toast.error("Status change blocked", publicMasterError(err));
    }
  }

  async function issueNumber(row: Record<string, unknown> & { id: string }) {
    try {
      const result = await issueDocumentNumber(
        String(row.documentType || ""),
        row.financialYear ? String(row.financialYear) : undefined
      );
      toast.success("Document number issued", result.documentNumber);
      await reload();
    } catch (err) {
      toast.error("Numbering failed", publicMasterError(err));
    }
  }

  return (
    <div>
      <PageHeader
        title={title || definition.title}
        description={description || definition.description}
        actions={
          <>
            {actions}
            {can(masterPermission(entity, "create")) ? (
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                New record
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setCursorStack([undefined]);
          }}
          placeholder="Search code or name"
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
            <SelectItem value="all">All statuses</SelectItem>
            {(definition.statusOptions ?? [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
              ...(entity === "financialYears" ? [{ label: "Closed", value: "closed" }] : []),
            ]).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterKeys.includes("companyId") ? (
          <FilterSelect
            value={companyId}
            placeholder="Company"
            options={filterOptions.companies ?? []}
            onChange={(value) => {
              setCompanyId(value);
              setCursorStack([undefined]);
            }}
          />
        ) : null}
        {filterKeys.includes("plantId") ? (
          <FilterSelect
            value={plantId}
            placeholder="Plant"
            options={filterOptions.plants ?? []}
            onChange={(value) => {
              setPlantId(value);
              setCursorStack([undefined]);
            }}
          />
        ) : null}
        {filterKeys.includes("warehouseId") ? (
          <FilterSelect
            value={warehouseId}
            placeholder="Warehouse"
            options={filterOptions.warehouses ?? []}
            onChange={(value) => {
              setWarehouseId(value);
              setCursorStack([undefined]);
            }}
          />
        ) : null}
        {filterKeys.includes("departmentId") ? (
          <FilterSelect
            value={departmentId}
            placeholder="Department"
            options={filterOptions.departments ?? []}
            onChange={(value) => {
              setDepartmentId(value);
              setCursorStack([undefined]);
            }}
          />
        ) : null}
      </div>

      {error ? (
        <EmptyState
          title="Unable to load records"
          description={error}
          action={
            <Button variant="outline" onClick={() => void reload()}>
              Retry
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={[
            ...columns,
            {
              key: "actions",
              header: "Actions",
              cell: (row) => (
                <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                  <Button size="sm" variant="outline" onClick={() => openRecord(row, "view")}>
                    View
                  </Button>
                  {can(masterPermission(entity, "update")) ? (
                    <Button size="sm" variant="outline" onClick={() => openRecord(row, "edit")}>
                      Edit
                    </Button>
                  ) : null}
                  {can(masterPermission(entity, "update")) && row.status !== "closed" ? (
                    <Button
                      size="sm"
                      variant={row.status === "active" ? "destructive" : "outline"}
                      onClick={() =>
                        void changeStatus(row, row.status === "active" ? "inactive" : "active")
                      }
                    >
                      {row.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                  ) : null}
                  {entity === "documentNumbering" ? (
                    <Button size="sm" variant="secondary" onClick={() => void issueNumber(row)}>
                      Issue next
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
          data={rows}
          loading={loading}
          searchable={false}
          paginate={false}
          emptyTitle={`No ${definition.title.toLowerCase()} yet`}
          emptyDescription="Create the first record to start building the organization hierarchy."
          onRowClick={(row) => openRecord(row, can(masterPermission(entity, "update")) ? "edit" : "view")}
          getRowId={(row) => row.id}
          footer={
            <div className="flex w-full items-center justify-between">
              <p>
                {rows.length} record{rows.length === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cursorStack.length < 2}
                  onClick={() => setCursorStack((stack) => stack.slice(0, -1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>
              {mode === "create"
                ? `New ${definition.title}`
                : mode === "edit"
                  ? `Edit ${definition.title}`
                  : definition.title}
            </SheetTitle>
            <SheetDescription>{definition.description}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <MasterForm
              entity={entity}
              values={selected ?? undefined}
              readOnly={mode === "view"}
              submitting={submitting}
              onSubmit={save}
              onCancel={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterSelect({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {placeholder.toLowerCase()}s</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function renderCell(
  key: string,
  row: Record<string, unknown>,
  labels: Record<string, string>
) {
  const value = row[key];
  if (key === "status") {
    const status = String(value || "inactive");
    return (
      <StatusBadge
        label={status}
        tone={status === "active" ? "success" : status === "closed" ? "hold" : "warning"}
      />
    );
  }
  if (key === "isCurrent") {
    return <StatusBadge label={value ? "Current" : "No"} tone={value ? "info" : "neutral"} />;
  }
  if (key === "steps" && Array.isArray(value)) {
    return `${value.length} step${value.length === 1 ? "" : "s"}`;
  }
  if (typeof value === "string" && (key.endsWith("Id") || key === "fromUomId" || key === "toUomId" || key === "uom")) {
    const mapped = Object.entries(labels).find(([mapKey]) => mapKey.endsWith(`:${value}`))?.[1];
    return mapped || value || "—";
  }
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}
