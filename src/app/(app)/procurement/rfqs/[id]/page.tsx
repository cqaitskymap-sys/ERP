import { ProcurementDocumentDetail, rfqActions } from "@/components/procurement/document-pages";
import { rfqStatusOptions } from "@/lib/procurement/catalog";

export default async function RfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <ProcurementDocumentDetail
      resource="rfqs"
      id={id}
      permission="rfq:read"
      titleKey="rfqNumber"
      statusOptions={rfqStatusOptions}
      actions={rfqActions}
      auditResource="rfqs"
    />
  );
}
