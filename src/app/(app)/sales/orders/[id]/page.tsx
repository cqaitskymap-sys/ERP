import { SalesOrderDetail } from "@/components/sales/document-pages";

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SalesOrderDetail id={id} />;
}
