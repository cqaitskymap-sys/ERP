import { QaRecordDetail } from "@/components/qa/qa-pages";
import { capaStatusOptions } from "@/lib/qa/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <QaRecordDetail
      resource="capas"
      id={id}
      permission="qaCapa:read"
      titleKey="capaNumber"
      statusOptions={capaStatusOptions}
      actions={[
        { action: "approve", label: "Approve / advance", permission: "qaCapa:approve", requireReason: true },
        { action: "close", label: "Close", permission: "qaCapa:close", requireReason: true },
      ]}
    />
  );
}
