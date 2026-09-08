import { ProductionDocumentDetail } from "@/components/production/document-pages";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";

export default async function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProductionDocumentDetail
      resource="equipment"
      id={id}
      permission="production:read"
      titleKey="equipmentName"
      statusOptions={[
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
        { value: "under_maintenance", label: "Under Maintenance" },
      ]}
      actions={[]}
      auditResource={PRODUCTION_COLLECTIONS.equipment}
    />
  );
}
