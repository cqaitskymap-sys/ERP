import { PvRecordDetail } from "@/components/pv/pv-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PvRecordDetail resource="rules" id={id} permission="pvRegulatoryReport:read" titleKey="ruleNumber" statusOptions={[{ value: "active", label: "Active" }]} actions={[]} />;
}
