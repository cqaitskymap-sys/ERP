"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ModuleWorkspaceProvider } from "@/lib/modules/module-workspace-context";
import { ConfirmProvider } from "@/components/providers/confirm-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <ModuleWorkspaceProvider>
            <ConfirmProvider>
              {children}
              <Toaster position="top-right" richColors closeButton />
            </ConfirmProvider>
          </ModuleWorkspaceProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
