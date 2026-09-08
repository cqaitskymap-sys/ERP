import { QcDocumentDetail } from "@/components/qc/qc-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <QcDocumentDetail
      resource="stability"
      id={id}
      permission="qcStability:read"
      titleKey="studyNumber"
      statusOptions={[
        { value: "planned", label: "Planned" },
        { value: "active", label: "Active" },
        { value: "completed", label: "Completed" },
      ]}
      auditResource="qcStabilityStudies"
      actions={[]}
    />
  );
}
