import { InventoryDetail } from "@/components/warehouse/inventory-detail";

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InventoryDetail id={id} />;
}
