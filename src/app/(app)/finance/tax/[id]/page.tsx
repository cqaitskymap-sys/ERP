import { TaxCodeDetail } from "@/components/finance/document-pages";

export default async function TaxCodeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TaxCodeDetail id={id} />;
}