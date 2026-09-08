"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequirePermission } from "@/components/auth/require-permission";
import { PageHeader } from "@/components/layout/page-header";
import { MasterForm } from "@/components/masters/master-form";
import { LoadingState } from "@/components/feedback/loading-state";
import { getMasterRecord, createMasterRecord, updateMasterRecord } from "@/lib/masters/client";
import { publicMasterError } from "@/lib/masters/errors";
import { getMasterDefinition } from "@/lib/masters/registry";
import { toast } from "@/lib/feedback/toast";
import { useConfirm } from "@/hooks/use-confirm";
import type { MasterEntity } from "@/types/masters";
import type { Permission } from "@/types/permissions";

interface RecordEditorProps {
  entity: MasterEntity;
  id?: string;
  permission: Permission;
  listHref: string;
}

export function RecordEditor({ entity, id, permission, listHref }: RecordEditorProps) {
  return (
    <RequirePermission permission={permission}>
      <EditorInner entity={entity} id={id} listHref={listHref} />
    </RequirePermission>
  );
}

function EditorInner({
  entity,
  id,
  listHref,
}: Omit<RecordEditorProps, "permission">) {
  const definition = getMasterDefinition(entity)!;
  const router = useRouter();
  const confirm = useConfirm();
  const [values, setValues] = useState<Record<string, unknown> | undefined>();
  const [loading, setLoading] = useState(Boolean(id));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const timer = window.setTimeout(() => {
      void getMasterRecord(entity, id)
        .then((result) => setValues(result.record))
        .catch((error) => toast.error("Unable to load record", publicMasterError(error)))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [entity, id]);

  async function save(payload: Record<string, unknown>) {
    const accepted = await confirm({
      title: id ? "Save changes?" : "Create record?",
      description: "This change is audited. Historical versions are not overwritten.",
      confirmLabel: id ? "Save" : "Create",
    });
    if (!accepted) return;
    setSubmitting(true);
    try {
      const result = id
        ? await updateMasterRecord(entity, id, payload)
        : await createMasterRecord(entity, payload);
      toast.success(id ? "Record updated" : "Record created");
      router.push(`${listHref}/${result.record.id}`);
    } catch (error) {
      toast.error("Unable to save", publicMasterError(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title={id ? `Edit ${definition.title}` : `New ${definition.title}`}
        description={definition.description}
      />
      <div className="max-w-4xl rounded-xl border bg-card p-5 shadow-sm">
        <MasterForm
          entity={entity}
          values={values}
          submitting={submitting}
          onSubmit={save}
          onCancel={() => router.push(listHref)}
        />
      </div>
    </div>
  );
}
