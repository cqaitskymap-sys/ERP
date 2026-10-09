"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, LayoutGrid, Search, X } from "lucide-react";
import { StatusBadge } from "@/components/feedback/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useModuleWorkspace } from "@/lib/modules/module-workspace-context";
import {
  WORKSPACE_CATEGORIES,
  WORKSPACE_MODULES,
} from "@/lib/config/workspace-modules";
import { cn } from "@/lib/utils";

export default function ModulePickerPage() {
  const { user, profile, can } = useAuth();
  const { selectModule } = useModuleWorkspace();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const modules = WORKSPACE_MODULES.filter((module) => can(module.permission));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredModules = normalizedQuery
    ? modules.filter((module) =>
        [module.label, module.description, module.category]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : modules;

  const sections = WORKSPACE_CATEGORIES.map((category) => ({
    ...category,
    items: filteredModules.filter((module) => module.category === category.id),
  })).filter((section) => section.items.length > 0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const displayName = profile?.name || user?.displayName || "operator";
  const firstName = displayName.split(/\s+/)[0] || displayName;

  return (
    <div className="relative min-h-[calc(100vh-7rem)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 -top-24 h-[28rem] bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_68%)]" />
        <div className="absolute top-40 -right-24 size-[22rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_70%)] blur-2xl" />
        <div className="auth-grid absolute inset-0 opacity-[0.35] dark:opacity-50" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            {modules.length} workspace
            {modules.length === 1 ? "" : "s"} available
          </div>
          <h1 className="mt-5 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
            Pick one module to focus. Everything else stays out of the way until
            you switch.
          </p>

          <div className="group relative mt-7 max-w-xl">
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/25 via-primary/10 to-transparent opacity-0 blur-md transition-opacity duration-300 group-focus-within:opacity-100" />
            <div className="relative flex items-center rounded-2xl border border-border/80 bg-card/70 shadow-[inset_0_1px_0_0_color-mix(in_oklch,white_6%,transparent)] backdrop-blur-md transition-[border-color,box-shadow,background-color] group-focus-within:border-primary/45 group-focus-within:bg-card/90 group-focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_18%,transparent),0_12px_32px_-20px_color-mix(in_oklch,var(--primary)_45%,transparent)]">
              <Search className="ml-4 size-4 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search modules, workspaces…"
                aria-label="Search modules"
                className="h-12 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground/70"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="mr-2 inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <kbd className="mr-3 hidden h-7 shrink-0 items-center rounded-lg border border-border/70 bg-background/60 px-2 font-sans text-[10px] font-medium tracking-wide text-muted-foreground sm:inline-flex">
                  /
                </kbd>
              )}
            </div>
          </div>
        </header>

        {modules.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="No modules available"
            description="Your account does not have access to any business modules yet. Ask an administrator to assign roles."
          />
        ) : sections.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching modules"
            description={`Nothing matched “${query.trim()}”. Try a different name or clear the search.`}
          />
        ) : (
          <div className="space-y-14">
            {sections.map((section) => (
              <section key={section.id} className="scroll-mt-8">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="h-6 w-1 shrink-0 rounded-full bg-primary" />
                      <h2 className="font-heading text-xl font-semibold tracking-tight">
                        {section.label}
                      </h2>
                    </div>
                    <p className="mt-2 ml-4 text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <span className="hidden shrink-0 rounded-md border border-border/80 bg-card/60 px-2.5 py-1 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase sm:inline-flex">
                    {section.items.length} module
                    {section.items.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {section.items.map((module) => {
                    const Icon = module.icon;
                    const isPlanned = module.status === "planned";

                    return (
                      <button
                        key={module.id}
                        type="button"
                        onClick={() => selectModule(module.id)}
                        className={cn(
                          "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/70 p-5 text-left shadow-sm backdrop-blur-sm",
                          "transition-[transform,border-color,box-shadow,background-color] duration-200",
                          "hover:-translate-y-1 hover:border-primary/45 hover:bg-card hover:shadow-[0_16px_40px_-24px_color-mix(in_oklch,var(--primary)_55%,transparent)]",
                          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          isPlanned && "opacity-90"
                        )}
                      >
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                        <div className="pointer-events-none absolute -top-16 -right-12 size-36 rounded-full bg-primary/0 blur-2xl transition-colors group-hover:bg-primary/10" />

                        <div className="relative flex items-start justify-between gap-3">
                          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/18 to-primary/5 text-primary ring-1 ring-primary/15 transition-all group-hover:from-primary/28 group-hover:to-primary/10 group-hover:ring-primary/30">
                            <Icon className="size-5" strokeWidth={1.75} />
                          </div>
                          {isPlanned ? (
                            <StatusBadge label="Planned" tone="neutral" />
                          ) : null}
                        </div>

                        <div className="relative mt-5 flex flex-1 flex-col">
                          <h3 className="font-heading text-[1.05rem] font-semibold tracking-tight">
                            {module.label}
                          </h3>
                          <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                            {module.description}
                          </p>

                          <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
                            <span className="text-sm font-medium text-primary transition-colors group-hover:text-primary">
                              {isPlanned ? "Preview workspace" : "Open workspace"}
                            </span>
                            <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:bg-primary group-hover:text-primary-foreground">
                              <ArrowRight className="size-4" />
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
