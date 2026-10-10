import { ChangeRequestDetail } from "@/components/dms/record-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChangeRequestDetail id={id} />;
}
