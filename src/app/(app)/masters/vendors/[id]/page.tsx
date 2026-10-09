import { Suspense } from "react";
import { VendorDetail } from "@/components/partners/vendor-detail";
import { PageLoader } from "@/components/feedback/loading-state";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageLoader />}>
      <VendorDetail id={id} />
    </Suspense>
  );
}
