import { ProductStandardDetail } from "@/components/costing/document-pages";

export default async function StandardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductStandardDetail id={id} />;
}
