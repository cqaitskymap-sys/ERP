import { PurchaseTrackingPage } from "@/components/procurement/tracking-page";

export default async function TrackingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PurchaseTrackingPage id={id} />;
}
