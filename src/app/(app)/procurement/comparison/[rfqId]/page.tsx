import { ComparisonMatrix } from "@/components/procurement/comparison-matrix";

export default async function QuotationComparisonDetailPage({
  params,
}: {
  params: Promise<{ rfqId: string }>;
}) {
  const { rfqId } = await params;
  return <ComparisonMatrix rfqId={rfqId} />;
}
