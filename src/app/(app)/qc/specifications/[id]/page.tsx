import { QcDocumentDetail } from "@/components/qc/qc-pages";
import { specStatusOptions } from "@/lib/qc/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <QcDocumentDetail
      resource="specifications"
      id={id}
      permission="qcSpecification:read"
      titleKey="specificationNumber"
      statusOptions={specStatusOptions}
      auditResource="qcSpecifications"
      actions={[
        { action: "submit", label: "Submit for review", permission: "qcSpecification:submit" },
        { action: "approve", label: "Approve", permission: "qcSpecification:approve", requireReason: true },
        { action: "activate", label: "Make effective", permission: "qcSpecification:approve" },
        { action: "return", label: "Return", permission: "qcSpecification:update", requireReason: true },
        { action: "reject", label: "Reject", permission: "qcSpecification:approve", variant: "destructive", requireReason: true },
      ]}
    />
  );
}
