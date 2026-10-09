import { PayrollDetail } from "@/components/hr/document-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PayrollDetail id={id} />;
}
