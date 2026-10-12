"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { navigation } from "@/lib/config/navigation";
import { useModuleWorkspace } from "@/lib/modules/module-workspace-context";

export function WorkspaceSearch() {
  const router = useRouter();
  const { can } = useAuth();
  const { activeModule } = useModuleWorkspace();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const sectionIds = activeModule ? new Set(activeModule.sectionIds) : null;
    const itemIds = activeModule?.itemIds ? new Set(activeModule.itemIds) : null;
    return navigation
      .filter((section) => (sectionIds ? sectionIds.has(section.id) : true))
      .flatMap((section) =>
        section.items.filter(
          (item) =>
            can(item.permission) &&
            (!itemIds || itemIds.has(item.id)) &&
            item.href !== "/modules/audit"
        )
      );
  }, [activeModule, can]);

  const normalized = query.trim().toLowerCase();
  const matches = (
    normalized
      ? items.filter((item) =>
          [item.label, item.description, item.group, item.href].join(" ").toLowerCase().includes(normalized)
        )
      : items
  ).slice(0, 8);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      inputRef.current?.focus();
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function openItem(href: string) {
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    router.push(href);
  }

  return (
    <div className="group relative hidden w-72 xl:block">
      <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
      <Input
        ref={inputRef}
        value={query}
        placeholder="Search workspace…"
        aria-label="Search workspace"
        aria-expanded={open}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && matches[0]) {
            event.preventDefault();
            openItem(matches[0].href);
          }
          if (event.key === "Escape") {
            setQuery("");
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        className="h-9 rounded-full border-border/70 bg-muted/40 pr-16 pl-9 shadow-[inset_0_1px_0_0_color-mix(in_oklch,white_6%,transparent)] backdrop-blur-sm transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/70 focus-visible:border-primary/50 focus-visible:bg-card/80 focus-visible:ring-primary/20 dark:bg-muted/25 dark:focus-visible:bg-card/60"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 inline-flex h-6 -translate-y-1/2 items-center rounded-full border border-border/70 bg-background/70 px-2 font-sans text-[10px] font-medium tracking-wide text-muted-foreground shadow-sm">
        Ctrl K
      </kbd>
      {open && matches.length > 0 ? (
        <div
          id="workspace-search-results"
          className="absolute top-[calc(100%+0.4rem)] right-0 z-40 w-[22rem] overflow-hidden rounded-2xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {matches.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-muted"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => openItem(item.href)}
            >
              <span className="text-sm font-medium">{item.label}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">
                {item.group ? `${item.group} · ` : ""}
                {item.description}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
