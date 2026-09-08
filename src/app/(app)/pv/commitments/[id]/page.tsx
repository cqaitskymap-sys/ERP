import { PvRecordDetail } from "@/components/pv/pv-pages";
import { commitmentStatusOptions } from "@/lib/pv/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PvRecordDetail
      resource="commitments"
      id={id}
      permission="pvCommitment:read"
      titleKey="commitmentNumber"
      statusOptions={commitmentStatusOptions}
      actions={[
        { action: "start", label: "Start", permission: "pvCommitment:update" },
        { action: "evidence", label: "Pending evidence", permission: "pvCommitment:update" },
        { action: "complete", label: "Complete", permission: "pvCommitment:close", requireReason: true },
      ]}
    />
  );
}
