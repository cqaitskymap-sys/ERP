import { RaRecordDetail } from "@/components/ra/ra-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RaRecordDetail
      resource="dossiers"
      id={id}
      permission="raDossier:read"
      titleKey="dossierNumber"
      statusOptions={[{ value: "draft", label: "Draft" }, { value: "approved", label: "Approved" }]}
      actions={[{ action: "approve", label: "Approve dossier", permission: "raDossier:approve", requireReason: true }]}
    />
  );
}
