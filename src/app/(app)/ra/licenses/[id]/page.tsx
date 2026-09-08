import { RaRecordDetail } from "@/components/ra/ra-pages";
import { licenseStatusOptions } from "@/lib/ra/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RaRecordDetail
      resource="licenses"
      id={id}
      permission="raLicense:read"
      titleKey="licenseNumber"
      statusOptions={licenseStatusOptions}
      actions={[
        { action: "activate", label: "Activate", permission: "raLicense:update" },
        { action: "renew", label: "Renew", permission: "raLicense:update", requireReason: true },
      ]}
    />
  );
}
