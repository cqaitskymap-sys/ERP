import { ReturnDetail } from "@/components/sales/document-pages";

export default async function SalesReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReturnDetail id={id} />;
}
