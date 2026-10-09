import { SupplierInvoiceDetail } from "@/components/finance/document-pages";

export default async function SupplierInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierInvoiceDetail id={id} />;
}