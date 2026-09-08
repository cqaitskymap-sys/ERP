import { QcDocumentDetail } from "@/components/qc/qc-pages";
import { testRequestStatusOptions } from "@/lib/qc/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <QcDocumentDetail
      resource="testRequests"
      id={id}
      permission="qcTest:read"
      titleKey="testRequestNumber"
      statusOptions={testRequestStatusOptions}
      auditResource="qcTestRequests"
      actions={[]}
    />
  );
}
