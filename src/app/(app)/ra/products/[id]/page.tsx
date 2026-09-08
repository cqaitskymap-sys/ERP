import { RaRecordDetail } from "@/components/ra/ra-pages";
import { profileStatusOptions } from "@/lib/ra/catalog";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RaRecordDetail
      resource="profiles"
      id={id}
      permission="raProduct:read"
      titleKey="productName"
      statusOptions={profileStatusOptions}
      actions={[
        { action: "assessment", label: "Start assessment", permission: "raProduct:update" },
        { action: "required", label: "Registration required", permission: "raProduct:update" },
        { action: "in_progress", label: "In progress", permission: "raProduct:update" },
        { action: "register", label: "Mark registered", permission: "raProduct:update" },
      ]}
    />
  );
}
