import { ProcurementDocumentDetail, amendmentActions } from "@/components/procurement/document-pages";
import { amendmentStatusOptions } from "@/lib/procurement/catalog";

export default async function AmendmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ProcurementDocumentDetail
      resource="amendments"
      id={id}
      permission="purchaseOrderAmendment:create"
      titleKey="amendmentNumber"
      statusOptions={amendmentStatusOptions}
      actions={amendmentActions}
      auditResource="purchaseOrderAmendments"
    />
  );
}
