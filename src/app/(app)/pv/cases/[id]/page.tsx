import { CaseWorkspace } from "@/components/pv/pv-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseWorkspace id={id} />;
}
