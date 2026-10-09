import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { navigation } from "@/lib/config/navigation";
import { titleFromSlug } from "@/lib/utils/format";
import { getServerSession } from "@/lib/auth/server";
import { canAccess } from "@/lib/permissions/permission-service";

export default async function ModulePlaceholderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "warehouse") redirect("/warehouse");
  if (slug === "inventory") redirect("/warehouse/inventory");
  if (slug === "procurement") redirect("/procurement");
  if (slug === "production") redirect("/production");
  if (slug === "quality") redirect("/qc");
  if (slug === "compliance") redirect("/qa/compliance");
  if (slug === "regulatory") redirect("/ra");
  if (slug === "pharmacovigilance") redirect("/pv");
  if (slug === "complaints") redirect("/complaints");
  if (slug === "supplier-quality" || slug === "supplierQuality") redirect("/sq");
  if (slug === "maintenance" || slug === "engineering") redirect("/engineering");
  if (slug === "hr" || slug === "people") redirect("/hr");
  const session = await getServerSession();
  if (!session) redirect("/login");

  const item = navigation
    .flatMap((section) => section.items)
    .find((entry) => entry.href === `/modules/${slug}`);

  if (item?.permission && !canAccess(session, item.permission)) {
    redirect("/unauthorized");
  }

  const title = item?.label ?? titleFromSlug(slug);
  const Icon = item?.icon;

  return (
    <div>
      <PageHeader
        title={title}
        description={
          item?.description ??
          "This module route is reserved. Implementation will land in a later phase."
        }
      />
      <EmptyState
        icon={Icon}
        title={`${title} is not implemented yet`}
        description="Authorization succeeded. Business logic for this module will attach here later."
        action={
          <Button asChild>
            <Link href="/">Return to command center</Link>
          </Button>
        }
      />
    </div>
  );
}
