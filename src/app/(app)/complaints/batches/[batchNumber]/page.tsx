import { BatchProfilePage } from "@/components/complaints/complaint-pages";
export default async function Page({ params }: { params: Promise<{ batchNumber: string }> }) {
  const { batchNumber } = await params;
  return <BatchProfilePage batchNumber={decodeURIComponent(batchNumber)} />;
}
