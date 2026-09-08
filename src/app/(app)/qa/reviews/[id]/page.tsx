import { QaDecisionPage } from "@/components/qa/qa-decision";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QaDecisionPage id={id} />;
}
