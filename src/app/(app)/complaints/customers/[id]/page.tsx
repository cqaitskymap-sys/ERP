import { CustomerProfilePage } from "@/components/complaints/complaint-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerProfilePage id={id} />;
}
