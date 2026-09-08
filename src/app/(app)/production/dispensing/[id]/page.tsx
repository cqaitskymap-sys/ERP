import { ProductionDocumentDetail, dispensingActions } from "@/components/production/document-pages";
import { dispensingStatusOptions } from "@/lib/production/catalog";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";

export default async function DispensingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProductionDocumentDetail
      resource="dispensing"
      id={id}
      permission="dispensingRequest:read"
      titleKey="dispensingRequestNumber"
      statusOptions={dispensingStatusOptions}
      actions={dispensingActions}
      auditResource={PRODUCTION_COLLECTIONS.dispensing}
    />
  );
}
