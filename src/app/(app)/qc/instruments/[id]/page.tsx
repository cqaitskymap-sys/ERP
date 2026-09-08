import { QcDocumentDetail } from "@/components/qc/qc-pages";
import { instrumentStatusOptions } from "@/lib/qc/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <QcDocumentDetail
      resource="instruments"
      id={id}
      permission="qcInstrument:read"
      titleKey="instrumentCode"
      statusOptions={instrumentStatusOptions}
      auditResource="qcInstruments"
      actions={[]}
    />
  );
}
