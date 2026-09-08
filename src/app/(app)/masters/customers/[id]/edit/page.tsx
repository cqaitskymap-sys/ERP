import { RecordEditor } from "@/components/products/record-editor";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RecordEditor
      entity="customers"
      id={id}
      permission="customers:update"
      listHref="/masters/customers"
    />
  );
}
