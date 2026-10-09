import { FixedAssetDetail } from "@/components/finance/document-pages";

export default async function FixedAssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FixedAssetDetail id={id} />;
}