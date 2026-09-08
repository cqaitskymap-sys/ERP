import { RaRecordDetail } from "@/components/ra/ra-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RaRecordDetail
      resource="requirements"
      id={id}
      permission="raProduct:read"
      titleKey="requirementType"
      statusOptions={[{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }]}
      actions={[]}
    />
  );
}
