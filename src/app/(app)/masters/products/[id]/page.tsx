import { Suspense } from "react";
import { ProductDetail } from "@/components/products/product-detail";
import { LoadingState } from "@/components/feedback/loading-state";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<LoadingState />}>
      <ProductDetail id={id} />
    </Suspense>
  );
}
