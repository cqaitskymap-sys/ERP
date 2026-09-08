"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { FormField } from "@/components/forms/form-field";
import { FormSelect } from "@/components/forms/form-select";
import { FormSection } from "@/components/forms/form-section";
import { FormActions } from "@/components/forms/form-actions";
import { DataTable, type DataTableColumn } from "@/components/tables/data-table";
import { AppModal } from "@/components/feedback/app-modal";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/hooks/use-confirm";
import { toast } from "@/lib/feedback/toast";
import { RequirePermission } from "@/components/auth/require-permission";

interface PreviewRow {
  id: string;
  record: string;
  owner: string;
  state: string;
}

const previewRows: PreviewRow[] = [
  { id: "UI-001", record: "Reusable table row", owner: "Foundation", state: "Draft" },
  { id: "UI-002", record: "Modal + toast demo", owner: "Foundation", state: "Ready" },
  { id: "UI-003", record: "Confirm dialog demo", owner: "Foundation", state: "Hold" },
];

const columns: DataTableColumn<PreviewRow>[] = [
  { key: "id", header: "ID", accessor: "id", sortable: true },
  { key: "record", header: "Record", accessor: "record", sortable: true },
  { key: "owner", header: "Owner", accessor: "owner", hideOnMobile: true },
  {
    key: "state",
    header: "State",
    accessor: "state",
    cell: (row) => (
      <StatusBadge
        label={row.state}
        tone={
          row.state === "Ready"
            ? "success"
            : row.state === "Hold"
              ? "hold"
              : "neutral"
        }
      />
    ),
  },
];

export default function FoundationPage() {
  return (
    <RequirePermission permission="admin:read">
      <FoundationLab />
    </RequirePermission>
  );
}

function FoundationLab() {
  const confirm = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [status, setStatus] = useState("draft");

  async function onDestructive() {
    const accepted = await confirm({
      title: "Archive this preview record?",
      description:
        "This is a confirmation-system test. No manufacturing data will be changed.",
      confirmLabel: "Archive preview",
      variant: "destructive",
    });

    if (accepted) {
      toast.success("Confirmation accepted", "The dialog system resolved true.");
      return;
    }

    toast.info("Confirmation cancelled");
  }

  return (
    <div>
      <PageHeader
        title="Foundation lab"
        description="Reusable forms, tables, dialogs, toasts, and empty/loading states for future ERP modules."
      />

      <div className="grid gap-6">
        <FormSection
          title="Record identity"
          description="These fields are structural samples, not live batch or inventory data."
        >
          <FormField label="Record title" htmlFor="title" required hint="Shown in tables and audit descriptions.">
            <Input id="title" placeholder="Deviation intake form" />
          </FormField>
          <FormSelect
            id="status"
            label="Lifecycle state"
            value={status}
            onChange={setStatus}
            options={[
              { label: "Draft", value: "draft" },
              { label: "In review", value: "review" },
              { label: "Approved", value: "approved" },
            ]}
          />
          <FormField label="Notes" htmlFor="notes" className="md:col-span-2">
            <Textarea id="notes" placeholder="Optional operator notes" />
          </FormField>
          <FormActions className="md:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => toast.info("Draft retained", "No data was persisted.")}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => toast.success("Form pattern ready", "Modules can reuse this layout.")}
            >
              Save pattern
            </Button>
          </FormActions>
        </FormSection>

        <DataTable
          columns={columns}
          data={previewRows}
          searchPlaceholder="Search foundation previews"
          toolbar={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setModalOpen(true)}>
                Open modal
              </Button>
              <Button variant="destructive" onClick={() => void onDestructive()}>
                Test confirm
              </Button>
            </div>
          }
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <EmptyState
            title="Empty state"
            description="Use this when a collection has no documents yet."
          />
          <div className="rounded-xl border bg-card p-4">
            <p className="mb-3 text-sm font-medium">Loading state</p>
            <LoadingState variant="table" rows={3} />
          </div>
        </div>
      </div>

      <AppModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title="Reusable modal"
        description="Future modules can open this shell for create/edit flows."
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setModalOpen(false);
                toast.success("Modal closed");
              }}
            >
              Continue
            </Button>
          </>
        }
      >
        <FormField label="Example field" htmlFor="modal-field">
          <Input id="modal-field" placeholder="Attach any form control" />
        </FormField>
      </AppModal>
    </div>
  );
}
