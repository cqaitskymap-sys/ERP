import { ProductProfilePage } from "@/components/complaints/complaint-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductProfilePage id={id} />;
}
