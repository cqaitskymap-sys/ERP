import { RecordEditor } from "@/components/products/record-editor";

export default function NewProductPage() {
  return (
    <RecordEditor
      entity="products"
      permission="products:create"
      listHref="/masters/products"
    />
  );
}
