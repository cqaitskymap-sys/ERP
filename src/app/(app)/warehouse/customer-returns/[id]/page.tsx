import { CustomerReturnDetail } from "@/components/logistics/logistics-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <CustomerReturnDetail id={id} />; }
