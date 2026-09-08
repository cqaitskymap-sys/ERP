import { AuditWorkspace } from "@/components/sq/sq-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AuditWorkspace id={id} />;
}
