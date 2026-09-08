import { ProductionDocumentDetail, bmrActions } from "@/components/production/document-pages";
import { bmrStatusOptions } from "@/lib/production/catalog";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";

export default async function BmrDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProductionDocumentDetail
      resource="bmrs"
      id={id}
      permission="bmr:read"
      titleKey="bmrNumber"
      statusOptions={bmrStatusOptions}
      actions={bmrActions}
      auditResource={PRODUCTION_COLLECTIONS.bmrs}
    />
  );
}
