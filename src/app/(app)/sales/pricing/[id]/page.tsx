import { PriceListDetail } from "@/components/sales/document-pages";

export default async function PriceListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PriceListDetail id={id} />;
}
