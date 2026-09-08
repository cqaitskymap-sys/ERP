import { PvRecordDetail } from "@/components/pv/pv-pages";
import { followUpStatusOptions } from "@/lib/pv/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PvRecordDetail
      resource="followups"
      id={id}
      permission="pvFollowup:read"
      titleKey="followUpNumber"
      statusOptions={followUpStatusOptions}
      actions={[
        { action: "receive", label: "Mark received", permission: "pvFollowup:update" },
        { action: "review", label: "Under review", permission: "pvFollowup:update" },
        { action: "complete", label: "Close", permission: "pvFollowup:close", requireReason: true },
      ]}
    />
  );
}
