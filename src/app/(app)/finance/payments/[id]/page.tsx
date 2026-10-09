import { PaymentProposalDetail } from "@/components/finance/document-pages";

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentProposalDetail id={id} />;
}