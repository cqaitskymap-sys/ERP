import { RaRecordDetail } from "@/components/ra/ra-pages";
import { changeStatusOptions } from "@/lib/ra/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RaRecordDetail
      resource="changes"
      id={id}
      permission="raRegulatoryChange:read"
      titleKey="changeNumber"
      statusOptions={changeStatusOptions}
      actions={[
        { action: "assess", label: "RA assessment", permission: "raRegulatoryChange:update" },
        { action: "impact", label: "Impact assessment", permission: "raRegulatoryChange:update" },
        { action: "department", label: "Department review", permission: "raRegulatoryChange:update" },
        { action: "plan_action", label: "Action plan", permission: "raRegulatoryChange:update" },
        { action: "implement", label: "Implement", permission: "raRegulatoryChange:update" },
        { action: "verify", label: "Verify", permission: "raRegulatoryChange:update" },
        { action: "approve", label: "Close / approve", permission: "raRegulatoryChange:approve", requireReason: true },
      ]}
    />
  );
}
