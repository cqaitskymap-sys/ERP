import { PvRecordDetail } from "@/components/pv/pv-pages";
import { reportStatusOptions } from "@/lib/pv/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PvRecordDetail
      resource="reports"
      id={id}
      permission="pvRegulatoryReport:read"
      titleKey="reportNumber"
      statusOptions={reportStatusOptions}
      actions={[
        { action: "required", label: "Required", permission: "pvRegulatoryReport:update" },
        { action: "not_required", label: "Not required", permission: "pvRegulatoryReport:update", requireReason: true },
        { action: "prepare", label: "Prepare", permission: "pvRegulatoryReport:update" },
        { action: "internal", label: "Internal review", permission: "pvRegulatoryReport:update" },
        { action: "approve", label: "Approve", permission: "pvRegulatoryReport:approve", requireReason: true },
        { action: "submit", label: "Record submission", permission: "pvRegulatoryReport:submit", requireReason: true },
      ]}
    />
  );
}
