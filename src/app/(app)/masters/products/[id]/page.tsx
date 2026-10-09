import { Suspense } from "react";
import { ProductDetail } from "@/components/products/product-detail";
import { PageLoader } from "@/components/feedback/loading-state";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageLoader />}>
      <ProductDetail id={id} />
    </Suspense>
  );
}
