import Image from "next/image";
import { cn } from "@/lib/utils";
import { appConfig } from "@/lib/config/app";

export function BrandMark({
  collapsed = false,
  inverted = false,
  size = "default",
}: {
  collapsed?: boolean;
  inverted?: boolean;
  size?: "default" | "lg";
}) {
  const markSize = size === "lg" ? "size-14" : collapsed ? "size-9" : "size-10";
  const imageSize = size === "lg" ? 56 : collapsed ? 36 : 40;

  return (
    <div className={cn("flex items-center gap-2.5", size === "lg" && "gap-3")}>
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5",
          markSize,
          inverted && "ring-white/15"
        )}
      >
        <Image
          src={appConfig.logoSrc}
          alt={`${appConfig.name} logo`}
          width={imageSize}
          height={imageSize}
          className="object-contain p-0.5"
          priority
        />
      </div>
      {!collapsed ? (
        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-heading text-sm font-semibold tracking-tight",
              size === "lg" && "text-base",
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
