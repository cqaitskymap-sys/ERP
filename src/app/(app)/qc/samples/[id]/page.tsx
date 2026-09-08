import { QcDocumentDetail } from "@/components/qc/qc-pages";
import { sampleStatusOptions } from "@/lib/qc/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <QcDocumentDetail
      resource="samples"
      id={id}
      permission="qcSample:read"
      titleKey="sampleNumber"
      statusOptions={sampleStatusOptions}
      auditResource="qcSamples"
      actions={[]}
    />
  );
}
