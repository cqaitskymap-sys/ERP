import { ComplaintRecordDetail } from "@/components/complaints/complaint-pages";
import { notificationStatusOptions } from "@/lib/complaints/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ComplaintRecordDetail
      resource="notifications"
      id={id}
      permission="complaintRegulatory:read"
      titleKey="notificationNumber"
      statusOptions={notificationStatusOptions}
      actions={[
        { action: "required", label: "Required", permission: "complaintRegulatory:update" },
        { action: "not_required", label: "Not required", permission: "complaintRegulatory:update" },
        { action: "preparing", label: "Prepare", permission: "complaintRegulatory:update" },
        { action: "approve", label: "Approve", permission: "complaintRegulatory:approve", requireReason: true },
        { action: "submit", label: "Mark submitted", permission: "complaintRegulatory:submit", requireReason: true },
      ]}
    />
  );
}
