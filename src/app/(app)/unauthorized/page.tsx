import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div>
      <PageHeader
        title="Access denied"
        description="This route is protected by role-based authorization."
      />
      <EmptyState
        icon={ShieldX}
        title="Your role cannot open this module"
        description="The request was blocked by the authorization policy. Ask an administrator if you need additional rights."
        action={
          <Button asChild>
            <Link href="/">Return to command center</Link>
          </Button>
        }
      />
    </div>
  );
}
