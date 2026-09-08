import { Suspense } from "react";
import { IssueForm } from "@/components/warehouse/document-pages";

export default function NewIssuePage() {
  return (
    <Suspense>
      <IssueForm />
    </Suspense>
  );
}
