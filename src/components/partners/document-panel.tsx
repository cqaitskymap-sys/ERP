"use client";

import { useState } from "react";
import { RelatedMasterPanel } from "@/components/products/related-master-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/forms/form-select";
import { EmptyState } from "@/components/feedback/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { getFileUrl } from "@/lib/services/storage-service";
import { uploadPartnerDocument } from "@/lib/partners/client";
import { publicMasterError } from "@/lib/masters/errors";
import { toast } from "@/lib/feedback/toast";
import {
  customerDocumentTypeOptions,
  documentStatusOptions,
  vendorDocumentTypeOptions,
} from "@/lib/partners/catalog";
import type { MasterEntity } from "@/types/masters";
import type { Permission } from "@/types/permissions";

export function DocumentPanel({
  kind,
  parentId,
  writePermission,
}: {
  kind: "customers" | "vendors";
  parentId: string;
  writePermission: Permission;
}) {
  const { can } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const entity = (kind === "customers" ? "customerDocuments" : "vendorDocuments") as MasterEntity;
  const parentField = kind === "customers" ? "customerId" : "vendorId";
  const options = kind === "customers" ? customerDocumentTypeOptions : vendorDocumentTypeOptions;

  async function upload() {
    if (!file || !documentType) {
      toast.error("Select a document type and file");
      return;
    }
    setSubmitting(true);
    try {
      await uploadPartnerDocument({
        kind,
        parentId,
        file,
        values: { documentType, status: "active" },
      });
      toast.success("Document uploaded");
      setFile(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      toast.error("Upload failed", publicMasterError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {can(writePermission) ? (
        <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3">
          <FormSelect
            label="Document type"
            value={documentType || undefined}
            options={options}
            onChange={setDocumentType}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium">File</label>
            <Input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            <p className="text-xs text-muted-foreground">PDF, image, Word, or Excel. Max 10 MB.</p>
          </div>
          <div className="flex items-end">
            <Button disabled={submitting} onClick={() => void upload()}>
              {submitting ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      ) : (
        <EmptyState title="Upload restricted" description="You can view documents you are permitted to access." />
      )}
      <RelatedMasterPanel
        key={reloadKey}
        entity={entity}
        locked={{ [parentField]: parentId }}
        writePermission={writePermission}
        defaults={{ [parentField]: parentId }}
      />
      <DocumentOpenHint />
    </div>
  );
}

function DocumentOpenHint() {
  return (
    <p className="text-xs text-muted-foreground">
      Files are stored privately. Open a document record, then use the stored path with an authenticated session.
    </p>
  );
}

export async function openStoredFile(path: string) {
  const url = await getFileUrl(path);
  window.open(url, "_blank", "noopener,noreferrer");
}

export { documentStatusOptions };
