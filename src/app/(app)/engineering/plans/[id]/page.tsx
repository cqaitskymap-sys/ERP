import { MaintenancePlanDetail } from "@/components/engineering/document-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MaintenancePlanDetail id={id} />;
}
