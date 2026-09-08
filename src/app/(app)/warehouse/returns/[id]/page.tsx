import { DocumentDetail, returnActions } from "@/components/warehouse/document-pages";
import { returnStatusOptions } from "@/lib/inventory/catalog";

export default async function ReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <DocumentDetail
      resource="returns"
      id={id}
      permission="inventory:read"
      titleKey="returnNumber"
      statusOptions={returnStatusOptions}
      actions={returnActions}
      auditResource="stockReturns"
    />
  );
}
