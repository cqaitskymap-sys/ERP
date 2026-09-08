import { ProductionDocumentDetail } from "@/components/production/document-pages";
import { deviationStatusOptions } from "@/lib/production/catalog";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";

export default async function DeviationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProductionDocumentDetail
      resource="deviations"
      id={id}
      permission="productionDeviation:read"
      titleKey="deviationNumber"
      statusOptions={deviationStatusOptions}
      actions={[]}
      auditResource={PRODUCTION_COLLECTIONS.deviations}
    />
  );
}
