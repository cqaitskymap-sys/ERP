import { DocumentDetail, receiptActions } from "@/components/warehouse/document-pages";
import { receiptStatusOptions } from "@/lib/inventory/catalog";

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <DocumentDetail
      resource="receipts"
      id={id}
      permission="goodsReceipt:read"
      titleKey="receiptNumber"
      statusOptions={receiptStatusOptions}
      actions={receiptActions}
      auditResource="goodsReceipts"
    />
  );
}
