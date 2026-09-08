import { PvRecordDetail } from "@/components/pv/pv-pages";
import { signalStatusOptions } from "@/lib/pv/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PvRecordDetail
      resource="signals"
      id={id}
      permission="pvSignal:read"
      titleKey="signalNumber"
      statusOptions={signalStatusOptions}
      actions={[
        { action: "screen", label: "Screening", permission: "pvSignal:update" },
        { action: "assess", label: "Assessment", permission: "pvSignal:assess", requireReason: true },
        { action: "confirm", label: "Confirm (reviewer)", permission: "pvSignal:assess", requireReason: true },
        { action: "monitor", label: "Monitor", permission: "pvSignal:update" },
        { action: "close", label: "Close", permission: "pvSignal:close", requireReason: true },
      ]}
    />
  );
}
