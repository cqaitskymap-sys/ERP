import { RaRecordDetail } from "@/components/ra/ra-pages";
import { documentStatusOptions } from "@/lib/ra/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RaRecordDetail
      resource="documents"
      id={id}
      permission="raDocument:read"
      titleKey="documentNumber"
      statusOptions={documentStatusOptions}
      actions={[
        { action: "review", label: "Send for review", permission: "raDocument:update" },
        { action: "approve", label: "Approve", permission: "raDocument:approve", requireReason: true },
      ]}
    />
  );
}
