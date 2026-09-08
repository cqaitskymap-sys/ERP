import { DocumentDetail, adjustmentActions } from "@/components/warehouse/document-pages";
import { adjustmentStatusOptions } from "@/lib/inventory/catalog";

export default async function AdjustmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <DocumentDetail
      resource="adjustments"
      id={id}
      permission="inventory:read"
      titleKey="adjustmentNumber"
      statusOptions={adjustmentStatusOptions}
      actions={adjustmentActions}
      auditResource="stockAdjustments"
    />
  );
}
