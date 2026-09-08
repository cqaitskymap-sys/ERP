import { QcDocumentDetail } from "@/components/qc/qc-pages";
import { oosStatusOptions } from "@/lib/qc/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <QcDocumentDetail
      resource="oos"
      id={id}
      permission="qcOos:read"
      titleKey="oosNumber"
      statusOptions={oosStatusOptions}
      auditResource="qcOOS"
      actions={[]}
    />
  );
}
