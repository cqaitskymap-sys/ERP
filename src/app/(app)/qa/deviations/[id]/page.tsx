import { QaRecordDetail } from "@/components/qa/qa-pages";
import { qaDeviationStatusOptions } from "@/lib/qa/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <QaRecordDetail
      resource="deviations"
      id={id}
      permission="qaDeviation:read"
      titleKey="deviationNumber"
      statusOptions={qaDeviationStatusOptions}
      actions={[
        { action: "investigate", label: "Move to investigation", permission: "qaDeviation:update", requireReason: true },
        { action: "review", label: "QA review", permission: "qaDeviation:update" },
        { action: "capa", label: "CAPA required", permission: "qaDeviation:update" },
        { action: "close", label: "Close", permission: "qaDeviation:close", requireReason: true },
      ]}
    />
  );
}
