import { ProductionDocumentDetail, scheduleActions } from "@/components/production/document-pages";
import { scheduleStatusOptions } from "@/lib/production/catalog";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";

export default async function ScheduleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ProductionDocumentDetail
      resource="schedules"
      id={id}
      permission="productionSchedule:read"
      titleKey="scheduleNumber"
      statusOptions={scheduleStatusOptions}
      actions={scheduleActions}
      auditResource={PRODUCTION_COLLECTIONS.schedules}
    />
  );
}
