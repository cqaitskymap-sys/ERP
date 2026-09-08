import { RecordEditor } from "@/components/products/record-editor";

export default async function EditMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RecordEditor
      entity="materials"
      id={id}
      permission="materials:update"
      listHref="/masters/materials"
    />
  );
}
