import { CycleCountDetail } from "@/components/logistics/logistics-pages";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <CycleCountDetail id={id} />; }
