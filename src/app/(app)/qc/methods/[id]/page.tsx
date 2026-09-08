import { QcDocumentDetail } from "@/components/qc/qc-pages";
import { specStatusOptions } from "@/lib/qc/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <QcDocumentDetail
      resource="methods"
      id={id}
      permission="qcTestMethod:read"
      titleKey="methodNumber"
      statusOptions={specStatusOptions}
      auditResource="qcTestMethods"
      actions={[
        { action: "submit", label: "Submit for review", permission: "qcTestMethod:update" },
        { action: "approve", label: "Approve", permission: "qcTestMethod:approve", requireReason: true },
      ]}
    />
  );
}
