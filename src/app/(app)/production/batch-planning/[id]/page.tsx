import { ProductionDocumentDetail } from "@/components/production/document-pages";
import { batchPlanStatusOptions } from "@/lib/production/catalog";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";

export default async function BatchPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProductionDocumentDetail
      resource="batchPlans"
      id={id}
      permission="batchPlan:read"
      titleKey="batchPlanNumber"
      statusOptions={batchPlanStatusOptions}
      actions={[]}
      auditResource={PRODUCTION_COLLECTIONS.batchPlans}
    />
  );
}
