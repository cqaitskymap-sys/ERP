import { BatchCostingDetail } from "@/components/costing/document-pages";

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BatchCostingDetail id={id} />;
}
