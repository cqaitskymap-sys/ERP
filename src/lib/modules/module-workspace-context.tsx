"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
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

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function storedModuleId() {
  return readStoredWorkspaceModuleId() ?? "";
}

function persistModuleId(id: string | null) {
  if ((readStoredWorkspaceModuleId() ?? null) === id) return;
  writeStoredWorkspaceModuleId(id);
  listeners.forEach((listener) => listener());
}

export function ModuleWorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const storedId = useSyncExternalStore(subscribe, storedModuleId, () => "");
  const inferredId = pathname === "/" ? null : inferWorkspaceModuleId(pathname);
  const activeModuleId = pathname === "/" ? null : inferredId ?? (storedId || null);

  useEffect(() => {
    if (pathname === "/") {
      persistModuleId(null);
      return;
    }
    if (inferredId) persistModuleId(inferredId);
  }, [inferredId, pathname]);

  const selectModule = useCallback(
    (moduleId: string) => {
      const selected = getWorkspaceModule(moduleId);
      if (!selected) return;
      persistModuleId(selected.id);
      router.push(selected.href);
    },
    [router]
  );

  const clearModule = useCallback(() => {
    persistModuleId(null);
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
