import { RaRecordDetail } from "@/components/ra/ra-pages";
import { commitmentStatusOptions } from "@/lib/ra/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RaRecordDetail
      resource="commitments"
      id={id}
      permission="raCommitment:read"
      titleKey="commitmentNumber"
      statusOptions={commitmentStatusOptions}
      actions={[
        { action: "start", label: "Start", permission: "raCommitment:update" },
        { action: "evidence", label: "Pending evidence", permission: "raCommitment:update" },
        { action: "complete", label: "Complete", permission: "raCommitment:close", requireReason: true },
      ]}
    />
  );
}
