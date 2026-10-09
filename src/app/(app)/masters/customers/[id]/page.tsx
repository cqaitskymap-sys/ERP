import { Suspense } from "react";
import { CustomerDetail } from "@/components/partners/customer-detail";
import { PageLoader } from "@/components/feedback/loading-state";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<PageLoader />}>
      <CustomerDetail id={id} />
    </Suspense>
  );
}
