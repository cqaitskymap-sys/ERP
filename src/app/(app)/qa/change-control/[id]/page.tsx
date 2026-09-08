import { QaRecordDetail } from "@/components/qa/qa-pages";
import { changeStatusOptions } from "@/lib/qa/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <QaRecordDetail
      resource="changes"
      id={id}
      permission="qaChangeControl:read"
      titleKey="changeNumber"
      statusOptions={changeStatusOptions}
      actions={[
        { action: "submit", label: "Submit", permission: "qaChangeControl:update" },
        { action: "assess", label: "Impact assessment", permission: "qaChangeControl:update" },
        { action: "review", label: "QA review", permission: "qaChangeControl:update" },
        { action: "approve", label: "Approve", permission: "qaChangeControl:approve", requireReason: true },
        { action: "implement", label: "Implement", permission: "qaChangeControl:update" },
        { action: "verify", label: "Verify", permission: "qaChangeControl:update" },
        { action: "close", label: "Close", permission: "qaChangeControl:close", requireReason: true },
        { action: "reject", label: "Reject", permission: "qaChangeControl:approve", variant: "destructive", requireReason: true },
      ]}
    />
  );
}
