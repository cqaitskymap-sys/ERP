"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { MasterForm } from "@/components/masters/master-form";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/feedback/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useMasterList } from "@/hooks/use-masters";
import { createMasterRecord, updateMasterRecord } from "@/lib/masters/client";
import { publicMasterError } from "@/lib/masters/errors";
import { getMasterDefinition } from "@/lib/masters/registry";
import { toast } from "@/lib/feedback/toast";
import type { MasterEntity, MasterListQuery } from "@/types/masters";
import type { Permission } from "@/types/permissions";

type MasterRow = Record<string, unknown> & { id: string };

interface RelatedMasterPanelProps {
  entity: MasterEntity;
  locked?: Partial<MasterListQuery>;
  writePermission: Permission;
  defaults?: Record<string, unknown>;
}

export function RelatedMasterPanel({
  entity,
  locked,
  writePermission,
  defaults,
}: RelatedMasterPanelProps) {
  const definition = getMasterDefinition(entity)!;
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit" | "view">("create");
  const [selected, setSelected] = useState<MasterRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { rows, loading, error, reload } = useMasterList(entity, {
    ...locked,
    pageSize: 20,
  });

  function openCreate() {
    setSelected(null);
    setMode("create");
    setOpen(true);
  }

  async function save(values: Record<string, unknown>) {
    setSubmitting(true);
    try {
      const payload = { ...defaults, ...locked, ...values };
      if (selected?.id && mode === "edit") {
        await updateMasterRecord(entity, selected.id, payload);
        toast.success("Record updated");
      } else {
        await createMasterRecord(entity, payload);
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {can(writePermission) ? (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Add
          </Button>
        ) : null}
      </div>
      {error ? (
        <EmptyState title="Unable to load records" description={error} />
      ) : (
        <DataTable<MasterRow>
          searchable={false}
          paginate={false}
          loading={loading}
          data={rows}
          emptyTitle={`No ${definition.title.toLowerCase()} yet`}
          emptyDescription={definition.description}
          getRowId={(row) => row.id}
          columns={definition.columns.map((column) => ({
            key: column.key,
            header: column.header,
            accessor: column.key as keyof MasterRow,
            hideOnMobile: column.hideOnMobile,
            cell: (row) =>
              column.key === "status" ? (
                <StatusBadge
                  label={String(row.status || "")}
                  tone={
                    row.status === "active" || row.status === "approved"
                      ? "success"
                      : row.status === "draft" || row.status === "under_review"
                        ? "info"
                        : "warning"
                  }
                />
              ) : (
                String(row[column.key] ?? "—")
              ),
          }))}
          onRowClick={(row) => {
            setSelected(row);
            setMode(can(writePermission) ? "edit" : "view");
            setOpen(true);
          }}
        />
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{definition.title}</SheetTitle>
            <SheetDescription>{definition.description}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            <MasterForm
              entity={entity}
              values={{ ...defaults, ...locked, ...selected }}
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
