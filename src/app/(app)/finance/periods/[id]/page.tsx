import { PeriodDetail } from "@/components/finance/document-pages";

export default async function PeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PeriodDetail id={id} />;
}