import { QaRecordDetail } from "@/components/qa/qa-pages";
import { qaDocumentStatusOptions } from "@/lib/qa/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <QaRecordDetail
      resource="documents"
      id={id}
      permission="qaDocumentReview:read"
      titleKey="documentNumber"
      statusOptions={qaDocumentStatusOptions}
      actions={[
        { action: "submit", label: "Submit for review", permission: "qaDocumentReview:read" },
        { action: "approve", label: "Approve", permission: "qaDocumentReview:approve", requireReason: true },
        { action: "activate", label: "Make effective", permission: "qaDocumentReview:approve" },
        { action: "reject", label: "Reject", permission: "qaDocumentReview:reject", variant: "destructive", requireReason: true },
      ]}
    />
  );
}
