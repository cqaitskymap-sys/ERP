"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";
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
  const { can, hasRole, loading } = useAuth();

  if (loading) return null;

  const allowed = permission ? can(permission) : role ? hasRole(role) : true;
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
