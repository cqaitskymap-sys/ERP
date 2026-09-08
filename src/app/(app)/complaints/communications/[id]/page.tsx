import { ComplaintRecordDetail } from "@/components/complaints/complaint-pages";
import { communicationStatusOptions } from "@/lib/complaints/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ComplaintRecordDetail
      resource="communications"
      id={id}
      permission="complaintCommunication:read"
      titleKey="subject"
      statusOptions={communicationStatusOptions}
      actions={[
        { action: "review", label: "Send for review", permission: "complaintCommunication:create" },
        { action: "approve", label: "Approve", permission: "complaintCommunication:approve", requireReason: true },
        { action: "send", label: "Mark sent", permission: "complaintCommunication:send", requireReason: true },
        { action: "acknowledged", label: "Acknowledged", permission: "complaintCommunication:approve" },
      ]}
    />
  );
}
