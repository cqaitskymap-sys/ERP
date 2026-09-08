import { RaRecordDetail } from "@/components/ra/ra-pages";
import { submissionStatusOptions } from "@/lib/ra/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RaRecordDetail
      resource="submissions"
      id={id}
      permission="raSubmission:read"
      titleKey="submissionNumber"
      statusOptions={submissionStatusOptions}
      actions={[
        { action: "preparation", label: "In preparation", permission: "raSubmission:update" },
        { action: "internal", label: "Internal review", permission: "raSubmission:update" },
        { action: "approve", label: "Approve for submission", permission: "raSubmission:approve", requireReason: true },
        { action: "submit", label: "Submit", permission: "raSubmission:submit", requireReason: true },
        { action: "version", label: "New version", permission: "raSubmission:update", requireReason: true },
      ]}
    />
  );
}
