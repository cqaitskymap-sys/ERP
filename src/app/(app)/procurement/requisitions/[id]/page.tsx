import { ProcurementDocumentDetail, prActions } from "@/components/procurement/document-pages";
import { prStatusOptions } from "@/lib/procurement/catalog";

export default async function PurchaseRequisitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ProcurementDocumentDetail
      resource="requisitions"
      id={id}
      permission="purchaseRequisition:read"
      titleKey="requisitionNumber"
      statusOptions={prStatusOptions}
      actions={prActions}
      auditResource="purchaseRequisitions"
    />
  );
}
