"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  Factory,
  Landmark,
  LayoutGrid,
  Palette,
  Search,
  Truck,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/feedback/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { useAuth } from "@/hooks/use-auth";
import { useModuleWorkspace } from "@/lib/modules/module-workspace-context";
import {
  WORKSPACE_CATEGORIES,
  WORKSPACE_MODULES,
} from "@/lib/config/workspace-modules";
import { plantSnapshot } from "@/lib/dashboard/plant-snapshot";
import { BarBlock, ChartCard } from "@/components/charts/dashboard-charts";
import { cn } from "@/lib/utils";

export default function ModulePickerPage() {
  const { user, profile, can } = useAuth();
  const { selectModule } = useModuleWorkspace();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const modules = WORKSPACE_MODULES.filter((module) => can(module.permission));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredModules = normalizedQuery
      ? modules.filter((module) => {
        const snapshot = plantSnapshot(module.id);
        return [module.label, module.description, module.category, snapshot?.note, ...(snapshot?.metrics.flatMap((metric) => [metric.label, metric.value]) ?? [])]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
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
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayLabel = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="relative min-h-[calc(100vh-7rem)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 -top-24 h-[28rem] bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_68%)]" />
        <div className="absolute top-40 -right-24 size-[22rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_70%)] blur-2xl" />
        <div className="auth-grid absolute inset-0 opacity-[0.35] dark:opacity-50" />
      </div>

      <div className="relative w-full">
        <header className="mb-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            Bhiwadi plant · live
          </div>
          <h1 className="mt-5 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            One dashboard for the whole plant. Paracetamol for Cipla is released.
            Pantoprazole for Abbott is still on the coater, one day past plan.
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
                placeholder="Search the plant dashboard…"
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

        <section className="mb-8 overflow-hidden rounded-3xl bg-[oklch(0.22_0.04_220)] text-white shadow-[0_24px_60px_-36px_oklch(0.22_0.04_220)]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-teal-200/80 uppercase">
                PATRI Lifesciences · {todayLabel}
              </p>
              <p className="mt-1 font-heading text-lg font-semibold">Today on the floor</p>
            </div>
            <p className="text-sm text-white/60">WHO-GMP site · licence through Mar 2028</p>
          </div>
          <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-5">
            {PULSE.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => selectModule(item.moduleId)}
                  className="group bg-[oklch(0.22_0.04_220)] px-5 py-5 text-left transition-colors hover:bg-white/6"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-white/55">{item.label}</span>
                    <Icon className="size-4 text-teal-200/80" />
                  </div>
                  <p className="mt-3 font-heading text-2xl font-semibold tracking-tight">{item.value}</p>
                  <p className="mt-1 text-sm text-white/65">{item.detail}</p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mb-12 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {FLOOR.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => selectModule(item.moduleId)}
              className="rounded-2xl border border-border/80 bg-card/80 p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-card"
            >
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                {item.kicker}
              </p>
              <p className="mt-2 font-heading text-base font-semibold">{item.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
            </button>
          ))}
        </div>

        <div className="mb-12">
          <ChartCard title="Open work across the plant">
            <BarBlock
              data={[
                { name: "Open orders", value: 7 },
                { name: "Artwork in review", value: 4 },
                { name: "Batches on the floor", value: 2 },
                { name: "QA awaiting review", value: 2 },
                { name: "Open purchase orders", value: 2 },
                { name: "Open deviation", value: 1 },
              ]}
            />
          </ChartCard>
        </div>

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
            <div className="mb-2">
              <h2 className="font-heading text-xl font-semibold tracking-tight">Every module</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sales, production, quality, warehouse, finance, and the rest of the plant. Open a card to go into that workspace.
              </p>
            </div>
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

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/18 to-primary/5 text-primary ring-1 ring-primary/15 transition-all group-hover:from-primary/28 group-hover:to-primary/10 group-hover:ring-primary/30">
                              <Icon className="size-5" strokeWidth={1.75} />
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-heading text-[1.05rem] font-semibold tracking-tight">
                                {module.label}
                              </h3>
                              <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                {plantSnapshot(module.id)?.note || module.description}
                              </p>
                            </div>
                          </div>
                          {isPlanned ? <StatusBadge label="Planned" tone="neutral" /> : null}
                        </div>

                        <div className="relative mt-4 grid flex-1 grid-cols-3 gap-2">
                          {(plantSnapshot(module.id)?.metrics ?? []).map((metric) => (
                            <div key={metric.label} className="rounded-xl bg-muted/50 px-2.5 py-2">
                              <p className="font-heading text-lg font-semibold tracking-tight tabular-nums">{metric.value}</p>
                              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{metric.label}</p>
                            </div>
                          ))}
                        </div>

                        <div className="relative mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                          <span className="text-sm font-medium text-primary">
                            {isPlanned ? "Preview workspace" : "Open module"}
                          </span>
                          <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:bg-primary group-hover:text-primary-foreground">
                            <ArrowRight className="size-4" />
                          </span>
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

const PULSE = [
  {
    label: "October sales",
    value: "₹48.5 L",
    detail: "Contract revenue posted this month",
    moduleId: "sales",
    icon: Landmark,
  },
  {
    label: "Open customer orders",
    value: "7",
    detail: "From draft through ready to dispatch",
    moduleId: "sales",
    icon: Truck,
  },
  {
    label: "Batches on the floor",
    value: "2",
    detail: "1 past plan on the coater · 1 still manufacturing",
    moduleId: "production",
    icon: Factory,
  },
  {
    label: "Cash and bank",
    value: "₹2.08 Cr",
    detail: "HDFC operations and export escrow",
    moduleId: "finance",
    icon: ClipboardCheck,
  },
  {
    label: "Artwork in review",
    value: "4",
    detail: "QA, regulatory, customer, and one change",
    moduleId: "artwork",
    icon: Palette,
  },
] as const;

const FLOOR = [
  {
    kicker: "Released today",
    title: "PCM500-2610-1842",
    detail: "Paracetamol 500 mg for Cipla. 1.86 lakh tablets in finished goods, COA issued.",
    moduleId: "quality-assurance",
  },
  {
    kicker: "Needs a look",
    title: "PAN40-2610-033",
    detail: "Abbott pantoprazole is still in coating, one day past the plan. Deviation is open.",
    moduleId: "production",
  },
  {
    kicker: "Inbound",
    title: "PO-2026-220",
    detail: "Aurobindo Paracetamol IP is partly in. 350 kg is still due on 18 Oct.",
    moduleId: "procurement",
  },
  {
    kicker: "With the customer",
    title: "ART-2026-058",
    detail: "Abbott pantoprazole carton is waiting on Abbott. Cipla foil is still with QA.",
    moduleId: "artwork",
  },
] as const;
