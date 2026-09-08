import { QualificationDetail } from "@/components/sq/sq-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QualificationDetail id={id} />;
}
