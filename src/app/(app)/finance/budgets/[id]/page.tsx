import { BudgetDetail } from "@/components/finance/document-pages";

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BudgetDetail id={id} />;
}