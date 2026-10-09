import { QuotationDetail } from "@/components/sales/document-pages";

export default async function SalesQuotationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <QuotationDetail id={id} />;
}
