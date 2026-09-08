import { QcDocumentDetail } from "@/components/qc/qc-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <QcDocumentDetail
      resource="coas"
      id={id}
      permission="qcCoa:read"
      titleKey="coaNumber"
      statusOptions={[
        { value: "draft", label: "Draft" },
        { value: "approved", label: "Approved" },
      ]}
      auditResource="qcCOAs"
      actions={[{ action: "approve", label: "Approve COA", permission: "qcCoa:approve", requireReason: true }]}
    />
  );
}
