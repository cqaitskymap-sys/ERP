import { ProductionDocumentDetail, bomActions } from "@/components/production/document-pages";
import { bomStatusOptions } from "@/lib/production/catalog";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";

export default async function BomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProductionDocumentDetail
      resource="boms"
      id={id}
      permission="bom:read"
      titleKey="bomNumber"
      statusOptions={bomStatusOptions}
      actions={bomActions}
      auditResource={PRODUCTION_COLLECTIONS.boms}
    />
  );
}
