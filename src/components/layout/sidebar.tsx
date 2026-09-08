"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { navigation } from "@/lib/config/navigation";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/feedback/status-badge";
import { useAuth } from "@/hooks/use-auth";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, onToggle, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { can } = useAuth();
  const visibleNavigation = navigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => can(item.permission)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-white/8 bg-[oklch(0.20_0.028_230)] text-white transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-[272px]"
      )}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <BrandMark collapsed={collapsed} inverted />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          className="hidden text-white/70 hover:bg-white/10 hover:text-white lg:inline-flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3 pb-4">
        <div className="space-y-6">
          {visibleNavigation.map((section) => (
            <div key={section.id}>
              {!collapsed ? (
                <p className="mb-2 px-2 text-[11px] font-medium tracking-[0.16em] text-white/40 uppercase">
                  {section.label}
                </p>
              ) : null}
              <div className="space-y-1">
                {section.items.map((item, index) => {
                  const previousGroup = section.items[index - 1]?.group;
                  const showGroup = Boolean(item.group && item.group !== previousGroup && !collapsed);
                  const moreSpecific = section.items.some(
                    (other) =>
                      other.href !== item.href &&
                      other.href.startsWith(`${item.href}/`) &&
                      (pathname === other.href || pathname.startsWith(`${other.href}/`))
                  );
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : (pathname === item.href || pathname.startsWith(`${item.href}/`)) &&
                        !moreSpecific;
                  const Icon = item.icon;
                  const content = (
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                          : "text-white/70 hover:bg-white/8 hover:text-white",
                        collapsed && "justify-center px-0"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!collapsed ? (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.status === "planned" ? (
                            <StatusBadge
                              label="Soon"
                              tone="neutral"
                              className="bg-white/8 text-white/60"
                            />
                          ) : null}
                        </>
                      ) : null}
                    </Link>
                  );

                  if (!collapsed) {
                    return (
                      <div key={item.id}>
                        {showGroup ? (
                          <p className="mt-3 mb-1 px-2 text-[10px] font-medium tracking-[0.14em] text-white/30 uppercase first:mt-0">
                            {item.group}
                          </p>
                        ) : null}
                        {content}
                      </div>
                    );
                  }

                  return (
                    <Tooltip key={item.id}>
                      <TooltipTrigger asChild>{content}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {!collapsed ? (
        <div className="border-t border-white/8 p-4">
          <div className="rounded-lg bg-white/6 p-3">
            <p className="text-xs font-medium text-white/80">GMP workspace</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/45">
              Foundation is ready. Business modules will attach to this shell.
            </p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
