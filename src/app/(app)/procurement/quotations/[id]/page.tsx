import { ProcurementDocumentDetail, quotationActions } from "@/components/procurement/document-pages";
import { quotationStatusOptions } from "@/lib/procurement/catalog";

export default async function QuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ProcurementDocumentDetail
      resource="quotations"
      id={id}
      permission="quotation:read"
      titleKey="quotationNumber"
      statusOptions={quotationStatusOptions}
      actions={quotationActions}
      auditResource="vendorQuotations"
    />
  );
}
