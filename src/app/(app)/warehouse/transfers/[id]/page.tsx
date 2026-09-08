import { DocumentDetail, transferActions } from "@/components/warehouse/document-pages";
import { transferStatusOptions } from "@/lib/inventory/catalog";

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <DocumentDetail
      resource="transfers"
      id={id}
      permission="inventory:read"
      titleKey="transferNumber"
      statusOptions={transferStatusOptions}
      actions={transferActions}
      auditResource="stockTransfers"
    />
  );
}
