import { RecordEditor } from "@/components/products/record-editor";

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RecordEditor
      entity="vendors"
      id={id}
      permission="vendors:update"
      listHref="/masters/vendors"
    />
  );
}
