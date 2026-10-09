import { CmoDetail } from "@/components/sales/document-pages";

export default async function CmoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CmoDetail id={id} />;
}
