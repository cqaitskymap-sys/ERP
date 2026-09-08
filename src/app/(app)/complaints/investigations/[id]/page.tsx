import { ComplaintRecordDetail } from "@/components/complaints/complaint-pages";
import { investigationStatusOptions } from "@/lib/complaints/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ComplaintRecordDetail
      resource="investigations"
      id={id}
      permission="complaintInvestigation:read"
      titleKey="investigationNumber"
      statusOptions={investigationStatusOptions}
      actions={[
        { action: "in_progress", label: "In progress", permission: "complaintInvestigation:update" },
        { action: "pending_evidence", label: "Pending evidence", permission: "complaintInvestigation:update" },
        { action: "qa_review", label: "QA review", permission: "complaintInvestigation:update" },
        { action: "complete", label: "Complete", permission: "complaintInvestigation:complete", requireReason: true },
      ]}
    />
  );
}
