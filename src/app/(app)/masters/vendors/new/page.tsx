import { RecordEditor } from "@/components/products/record-editor";

export default function NewVendorPage() {
  return (
    <RecordEditor
      entity="vendors"
      permission="vendors:create"
      listHref="/masters/vendors"
    />
  );
}
