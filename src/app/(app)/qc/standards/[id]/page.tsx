import { QcDocumentDetail } from "@/components/qc/qc-pages";
import { standardStatusOptions } from "@/lib/qc/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <QcDocumentDetail
      resource="standards"
      id={id}
      permission="qcReferenceStandard:read"
      titleKey="standardCode"
      statusOptions={standardStatusOptions}
      auditResource="qcReferenceStandards"
      actions={[]}
    />
  );
}
