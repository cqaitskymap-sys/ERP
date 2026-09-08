import { Suspense } from "react";
import { AdjustmentForm } from "@/components/warehouse/document-pages";

export default function NewAdjustmentPage() {
  return (
    <Suspense>
      <AdjustmentForm />
    </Suspense>
  );
}
