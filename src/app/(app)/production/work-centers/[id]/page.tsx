import { ProductionDocumentDetail } from "@/components/production/document-pages";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";

export default async function WorkCenterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProductionDocumentDetail
      resource="workCenters"
      id={id}
      permission="production:read"
      titleKey="workCenterName"
      statusOptions={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
      actions={[]}
      auditResource={PRODUCTION_COLLECTIONS.workCenters}
    />
  );
}
