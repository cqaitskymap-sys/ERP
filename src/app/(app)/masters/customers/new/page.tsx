import { RecordEditor } from "@/components/products/record-editor";

export default function NewCustomerPage() {
  return (
    <RecordEditor
      entity="customers"
      permission="customers:create"
      listHref="/masters/customers"
    />
  );
}
