"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import type { AppRole, Permission } from "@/types/permissions";

interface CanProps {
  permission?: Permission | Permission[];
  role?: AppRole | AppRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function Can({ permission, role, children, fallback = null }: CanProps) {
  const { can, hasRole } = useAuth();
  const allowed = permission ? can(permission) : role ? hasRole(role) : true;
  return allowed ? <>{children}</> : <>{fallback}</>;
}
