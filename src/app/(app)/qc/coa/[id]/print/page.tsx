import { QcCoaPrint } from "@/components/qc/qc-coa-print";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QcCoaPrint id={id} />;
}
