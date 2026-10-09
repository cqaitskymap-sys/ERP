import { DebitNoteDetail } from "@/components/finance/document-pages";

export default async function DebitNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DebitNoteDetail id={id} />;
}