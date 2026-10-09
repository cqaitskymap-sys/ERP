import { CostCenterDetail } from "@/components/finance/document-pages";

export default async function CostCenterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CostCenterDetail id={id} />;
}