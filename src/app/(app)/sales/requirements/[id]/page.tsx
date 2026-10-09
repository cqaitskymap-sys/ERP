import { RequirementDetail } from "@/components/sales/document-pages";

export default async function RequirementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RequirementDetail id={id} />;
}
