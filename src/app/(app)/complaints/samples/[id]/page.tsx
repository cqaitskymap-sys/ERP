import { ComplaintRecordDetail } from "@/components/complaints/complaint-pages";
import { sampleStatusOptions } from "@/lib/complaints/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ComplaintRecordDetail
      resource="samples"
      id={id}
      permission="complaintSample:read"
      titleKey="sampleNumber"
      statusOptions={sampleStatusOptions}
      actions={[
        { action: "logged", label: "Log", permission: "complaintSample:update" },
        { action: "under_testing", label: "Under testing", permission: "complaintSample:update" },
        { action: "testing_complete", label: "Testing complete", permission: "complaintSample:update" },
        { action: "retained", label: "Retain", permission: "complaintSample:update" },
        { action: "disposed", label: "Dispose", permission: "complaintSample:update", requireReason: true },
      ]}
    />
  );
}
