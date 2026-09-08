"use client";

import { useAuth } from "@/hooks/use-auth";
import type { AppRole, Permission } from "@/types/permissions";

export function usePermission(permission?: Permission | Permission[]) {
  const { can, profile, loading } = useAuth();
  return {
    allowed: can(permission),
    loading,
    roles: profile?.roles ?? [],
    status: profile?.status,
  };
}

export function useRole(role?: AppRole | AppRole[]) {
  const { hasRole, profile, loading } = useAuth();
  return {
    allowed: hasRole(role),
    loading,
    role: profile?.role,
  };
}
