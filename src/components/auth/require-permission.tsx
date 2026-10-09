"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageLoader } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";
import { canAccessAny } from "@/lib/permissions/permission-service";
import type { AppRole, Permission } from "@/types/permissions";

interface RequirePermissionProps {
  permission?: Permission | Permission[];
  role?: AppRole | AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({
  permission,
  role,
  children,
  fallback,
}: RequirePermissionProps) {
  const { can, hasRole, loading, profile } = useAuth();

  if (loading) return <PageLoader label="Checking access" />;

  // Arrays mean "any of these" (alias lists), matching module API READ_ALIASES.
  const allowed = permission
    ? Array.isArray(permission)
      ? canAccessAny(profile, permission)
      : can(permission)
    : role
      ? hasRole(role)
      : true;
  if (allowed) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return (
    <EmptyState
      icon={ShieldX}
      title="Access denied"
      description="Your role does not include permission for this workspace area."
      action={
        <Button asChild>
          <Link href="/">Return to command center</Link>
        </Button>
      }
    />
  );
}
