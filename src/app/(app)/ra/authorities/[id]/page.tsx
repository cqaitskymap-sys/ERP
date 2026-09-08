import { RaRecordDetail } from "@/components/ra/ra-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RaRecordDetail resource="authorities" id={id} permission="raAuthority:read" titleKey="authorityName" statusOptions={[{ value: "active", label: "Active" }]} actions={[]} />;
}
