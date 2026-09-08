import { ProcurementDocumentDetail, poActions } from "@/components/procurement/document-pages";
import { poStatusOptions } from "@/lib/procurement/catalog";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ProcurementDocumentDetail
      resource="orders"
      id={id}
      permission="purchaseOrder:read"
      titleKey="poNumber"
      statusOptions={poStatusOptions}
      actions={poActions}
      auditResource="purchaseOrders"
    />
  );
}
