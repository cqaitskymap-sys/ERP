import { RaRecordDetail } from "@/components/ra/ra-pages";
import { registrationStatusOptions } from "@/lib/ra/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RaRecordDetail
      resource="registrations"
      id={id}
      permission="raRegistration:read"
      titleKey="registrationNumber"
      statusOptions={registrationStatusOptions}
      actions={[
        { action: "prepare", label: "Start preparation", permission: "raRegistration:update" },
        { action: "submit", label: "Mark submitted", permission: "raRegistration:update" },
        { action: "review", label: "Under review", permission: "raRegistration:update" },
        { action: "approve", label: "Approve", permission: "raRegistration:approve", requireReason: true },
        { action: "reject", label: "Reject", permission: "raRegistration:approve", variant: "destructive", requireReason: true },
      ]}
    />
  );
}
