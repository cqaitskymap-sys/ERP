import { CustomerInvoiceDetail } from "@/components/finance/document-pages";

export default async function CustomerInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerInvoiceDetail id={id} />;
}