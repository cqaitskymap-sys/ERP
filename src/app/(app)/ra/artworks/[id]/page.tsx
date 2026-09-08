import { RaRecordDetail } from "@/components/ra/ra-pages";
import { artworkStatusOptions } from "@/lib/ra/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RaRecordDetail
      resource="artworks"
      id={id}
      permission="raArtwork:read"
      titleKey="artworkNumber"
      statusOptions={artworkStatusOptions}
      actions={[
        { action: "ra_review", label: "RA review", permission: "raArtwork:create" },
        { action: "customer", label: "Customer review", permission: "raArtwork:create" },
        { action: "approve", label: "Approve", permission: "raArtwork:approve", requireReason: true },
      ]}
    />
  );
}
