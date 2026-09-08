import { RaRecordDetail } from "@/components/ra/ra-pages";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RaRecordDetail resource="communications" id={id} permission="raCommunication:read" titleKey="communicationNumber" statusOptions={[{ value: "logged", label: "Logged" }]} actions={[]} />;
}
