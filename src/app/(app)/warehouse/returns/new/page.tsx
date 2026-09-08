import { Suspense } from "react";
import { ReturnForm } from "@/components/warehouse/document-pages";

export default function NewReturnPage() {
  return (
    <Suspense>
      <ReturnForm />
    </Suspense>
  );
}
