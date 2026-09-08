import { Suspense } from "react";
import { TransferForm } from "@/components/warehouse/document-pages";

export default function NewTransferPage() {
  return (
    <Suspense>
      <TransferForm />
    </Suspense>
  );
}
