import { Suspense } from "react";
import { MaterialDetail } from "@/components/products/material-detail";
import { LoadingState } from "@/components/feedback/loading-state";

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<LoadingState />}>
      <MaterialDetail id={id} />
    </Suspense>
  );
}
