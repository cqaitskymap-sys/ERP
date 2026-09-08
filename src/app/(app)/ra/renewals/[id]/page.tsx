import { RaRecordDetail } from "@/components/ra/ra-pages";
import { renewalStatusOptions } from "@/lib/ra/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RaRecordDetail
      resource="renewals"
      id={id}
      permission="raRenewal:read"
      titleKey="renewalNumber"
      statusOptions={renewalStatusOptions}
      actions={[
        { action: "plan", label: "Start planning", permission: "raRenewal:update" },
        { action: "ready", label: "Mark ready", permission: "raRenewal:update" },
        { action: "submit", label: "Submit", permission: "raRenewal:update" },
        { action: "approve", label: "Approve", permission: "raRenewal:approve", requireReason: true },
      ]}
    />
  );
}
