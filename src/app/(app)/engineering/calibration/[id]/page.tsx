import { CalibrationDetail } from "@/components/engineering/document-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CalibrationDetail id={id} />;
}
