import { Customer360Page } from "@/components/sales/customer-360";

export default async function SalesCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Customer360Page id={id} />;
}
