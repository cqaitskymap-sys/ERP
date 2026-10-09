import { ExpenseClaimDetail } from "@/components/finance/document-pages";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExpenseClaimDetail id={id} />;
}