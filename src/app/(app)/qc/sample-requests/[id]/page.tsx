import { QcDocumentDetail } from "@/components/qc/qc-pages";
import { sampleRequestStatusOptions } from "@/lib/qc/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <QcDocumentDetail
      resource="sampleRequests"
      id={id}
      permission="qcSample:read"
      titleKey="sampleRequestNumber"
      statusOptions={sampleRequestStatusOptions}
      auditResource="qcSampleRequests"
      actions={[
        { action: "submit", label: "Submit request", permission: "qcSample:update" },
        { action: "approve", label: "Approve", permission: "qcSample:approve", requireReason: true },
        { action: "reject", label: "Reject", permission: "qcSample:approve", variant: "destructive", requireReason: true },
        { action: "cancel", label: "Cancel", permission: "qcSample:update", variant: "destructive", requireReason: true },
      ]}
    />
  );
}
