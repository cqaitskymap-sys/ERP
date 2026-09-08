import { cn } from "@/lib/utils";
import { appConfig } from "@/lib/config/app";

export function BrandMark({
  collapsed = false,
  inverted = false,
}: {
  collapsed?: boolean;
  inverted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-semibold tracking-[0.14em] text-primary-foreground",
          inverted && "bg-teal-300 text-slate-950"
        )}
      >
        {appConfig.shortName.slice(0, 3)}
      </div>
      {!collapsed ? (
        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-heading text-sm font-semibold tracking-tight",
              inverted && "text-white"
            )}
          >
            {appConfig.name}
          </p>
          <p
            className={cn(
              "truncate text-[11px] text-muted-foreground",
              inverted && "text-white/60"
            )}
          >
            Manufacturing ERP
          </p>
        </div>
      ) : null}
    </div>
  );
}
