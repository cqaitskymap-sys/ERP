import { PvRecordDetail } from "@/components/pv/pv-pages";
import { intakeStatusOptions } from "@/lib/pv/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PvRecordDetail
      resource="intakes"
      id={id}
      permission="pvIntake:read"
      titleKey="intakeNumber"
      statusOptions={intakeStatusOptions}
      actions={[
        { action: "triage_pending", label: "Triage pending", permission: "pvIntake:update" },
        { action: "duplicate", label: "Mark duplicate", permission: "pvIntake:update", requireReason: true },
        { action: "invalid", label: "Invalid", permission: "pvIntake:update", requireReason: true },
        { action: "closed", label: "Close", permission: "pvIntake:update", requireReason: true },
      ]}
    />
  );
}
