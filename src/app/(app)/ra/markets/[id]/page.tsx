import { RaRecordDetail } from "@/components/ra/ra-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RaRecordDetail resource="markets" id={id} permission="raMarket:read" titleKey="marketName" statusOptions={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} actions={[]} />;
}
