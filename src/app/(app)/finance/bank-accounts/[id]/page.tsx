import { BankAccountDetail } from "@/components/finance/document-pages";

export default async function BankAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BankAccountDetail id={id} />;
}