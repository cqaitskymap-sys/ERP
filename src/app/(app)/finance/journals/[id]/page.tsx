import { JournalDetail } from "@/components/finance/document-pages";

export default async function JournalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JournalDetail id={id} />;
}