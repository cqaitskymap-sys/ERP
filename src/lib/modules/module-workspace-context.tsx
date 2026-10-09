"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getWorkspaceModule,
  inferWorkspaceModuleId,
  readStoredWorkspaceModuleId,
  writeStoredWorkspaceModuleId,
  type WorkspaceModule,
} from "@/lib/config/workspace-modules";

interface ModuleWorkspaceContextValue {
  /** Null on the module picker (`/`) or when no module applies. */
  activeModule: WorkspaceModule | null;
  isPicker: boolean;
  selectModule: (moduleId: string) => void;
  clearModule: () => void;
  openModulePicker: () => void;
}

const ModuleWorkspaceContext = createContext<ModuleWorkspaceContextValue | null>(
  null
);

export function ModuleWorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setActiveModuleId(readStoredWorkspaceModuleId());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (pathname === "/") {
      setActiveModuleId(null);
      writeStoredWorkspaceModuleId(null);
      return;
    }

    const inferred = inferWorkspaceModuleId(pathname);
    if (!inferred) return;

    setActiveModuleId((current) => {
      if (current === inferred) return current;
      writeStoredWorkspaceModuleId(inferred);
      return inferred;
    });
  }, [hydrated, pathname]);

  const selectModule = useCallback(
    (moduleId: string) => {
      const selected = getWorkspaceModule(moduleId);
      if (!selected) return;
      setActiveModuleId(selected.id);
      writeStoredWorkspaceModuleId(selected.id);
      router.push(selected.href);
    },
    [router]
  );

  const clearModule = useCallback(() => {
    setActiveModuleId(null);
    writeStoredWorkspaceModuleId(null);
  }, []);

  const openModulePicker = useCallback(() => {
    clearModule();
    router.push("/");
  }, [clearModule, router]);

  const activeModule = useMemo(
    () => getWorkspaceModule(activeModuleId),
    [activeModuleId]
  );

  const value = useMemo<ModuleWorkspaceContextValue>(
    () => ({
      activeModule,
      isPicker: pathname === "/",
      selectModule,
      clearModule,
      openModulePicker,
    }),
    [activeModule, pathname, selectModule, clearModule, openModulePicker]
  );

  return (
    <ModuleWorkspaceContext.Provider value={value}>
      {children}
    </ModuleWorkspaceContext.Provider>
  );
}

export function useModuleWorkspace() {
  const context = useContext(ModuleWorkspaceContext);
  if (!context) {
    throw new Error(
      "useModuleWorkspace must be used within ModuleWorkspaceProvider."
    );
  }
  return context;
}
