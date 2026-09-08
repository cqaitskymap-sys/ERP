import { ProductionDocumentDetail, planActions } from "@/components/production/document-pages";
import { planStatusOptions } from "@/lib/production/catalog";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";

export default async function ProductionPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProductionDocumentDetail
      resource="plans"
      id={id}
      permission="productionPlan:read"
      titleKey="planNumber"
      statusOptions={planStatusOptions}
      actions={planActions}
      auditResource={PRODUCTION_COLLECTIONS.plans}
    />
  );
}
