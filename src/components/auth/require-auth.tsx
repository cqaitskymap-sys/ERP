"use client";

import type { ReactNode } from "react";
import { PageLoader } from "@/components/feedback/loading-state";
import { useAuth } from "@/hooks/use-auth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user, profile, isActive } = useAuth();

  if (loading) return <PageLoader />;
  if (!user || !profile || !isActive) return <PageLoader />;

  return <>{children}</>;
}
