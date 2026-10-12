import { ArtworkDetail } from "@/components/artwork/artwork-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArtworkDetail id={id} />;
}
