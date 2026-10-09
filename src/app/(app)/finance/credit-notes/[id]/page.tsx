import { CreditNoteDetail } from "@/components/finance/document-pages";

export default async function CreditNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CreditNoteDetail id={id} />;
}