import { RecordEditor } from "@/components/products/record-editor";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RecordEditor
      entity="products"
      id={id}
      permission="products:update"
      listHref="/masters/products"
    />
  );
}
