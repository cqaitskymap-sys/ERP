import { QuotationPrint } from "@/components/sales/quotation-print";

export default async function SalesQuotationPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <QuotationPrint id={id} />;
}
