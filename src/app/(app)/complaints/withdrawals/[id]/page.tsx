import { ComplaintRecordDetail } from "@/components/complaints/complaint-pages";
import { withdrawalStatusOptions } from "@/lib/complaints/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ComplaintRecordDetail
      resource="withdrawals"
      id={id}
      permission="complaintWithdrawal:read"
      titleKey="withdrawalNumber"
      statusOptions={withdrawalStatusOptions}
      actions={[
        { action: "assessment", label: "Assessment", permission: "complaintWithdrawal:update" },
        { action: "qa_review", label: "QA review", permission: "complaintWithdrawal:update" },
        { action: "approve", label: "Approve", permission: "complaintWithdrawal:approve", requireReason: true },
        { action: "customer_notification", label: "Customer notification", permission: "complaintWithdrawal:update" },
        { action: "recovery", label: "Recovery", permission: "complaintWithdrawal:update" },
        { action: "reconciliation", label: "Reconciliation", permission: "complaintWithdrawal:update" },
        { action: "closed", label: "Close", permission: "complaintWithdrawal:approve", requireReason: true },
      ]}
    />
  );
}
