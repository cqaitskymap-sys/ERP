import { BatchDetail } from "@/components/production/batch-detail";

export default async function ManufacturingOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BatchDetail id={id} />;
}
