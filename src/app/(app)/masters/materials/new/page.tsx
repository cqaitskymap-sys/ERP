import { RecordEditor } from "@/components/products/record-editor";

export default function NewMaterialPage() {
  return (
    <RecordEditor
      entity="materials"
      permission="materials:create"
      listHref="/masters/materials"
    />
  );
}
