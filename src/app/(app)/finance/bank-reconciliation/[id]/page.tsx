import { BankReconciliationDetail } from "@/components/finance/document-pages";

export default async function BankReconciliationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BankReconciliationDetail id={id} />;
}