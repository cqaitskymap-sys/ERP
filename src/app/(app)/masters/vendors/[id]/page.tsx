import { Suspense } from "react";
import { VendorDetail } from "@/components/partners/vendor-detail";
import { LoadingState } from "@/components/feedback/loading-state";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<LoadingState />}>
      <VendorDetail id={id} />
    </Suspense>
  );
}
