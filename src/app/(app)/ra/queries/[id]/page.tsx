import { RaRecordDetail } from "@/components/ra/ra-pages";
import { queryStatusOptions } from "@/lib/ra/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RaRecordDetail
      resource="queries"
      id={id}
      permission="raQuery:read"
      titleKey="queryNumber"
      statusOptions={queryStatusOptions}
      actions={[
        { action: "preparation", label: "In preparation", permission: "raQuery:update" },
        { action: "internal", label: "Internal review", permission: "raQuery:update" },
        { action: "approve", label: "Approve response", permission: "raQuery:approve", requireReason: true },
        { action: "submit", label: "Submit response", permission: "raQuery:approve", requireReason: true },
        { action: "close", label: "Close", permission: "raQuery:close", requireReason: true },
      ]}
    />
  );
}
