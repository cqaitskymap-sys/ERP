import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface LoadingStateProps {
  variant?: "spinner" | "page" | "card" | "table" | "inline";
  className?: string;
  rows?: number;
  label?: string;
}

function SpinnerMark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dimensions =
    size === "sm" ? "size-8" : size === "lg" ? "size-14" : "size-11";

  return (
    <div
      className={cn("relative", dimensions, className)}
      aria-hidden="true"
    >
      <span className="absolute inset-0 rounded-full bg-primary/15 blur-md" />
      <span className="patri-loader-ring absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary" />
      <span className="patri-loader-ring-reverse absolute inset-1.5 rounded-full border border-primary/10 border-b-primary/70" />
      <span className="absolute inset-0 m-auto size-1.5 rounded-full bg-primary shadow-[0_0_12px_color-mix(in_oklch,var(--primary)_80%,transparent)]" />
    </div>
  );
}

export function LoadingState({
  variant = "spinner",
  className,
  rows = 4,
  label = "Loading…",
}: LoadingStateProps) {
  if (variant === "inline") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2.5 text-sm text-muted-foreground",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <SpinnerMark size="sm" />
        <span>{label}</span>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className={cn("space-y-3", className)} role="status" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-56 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card/40">
          <Skeleton className="h-11 w-full rounded-none" />
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 border-t border-border/50 px-4 py-3"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-20 sm:block" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div className={cn("space-y-6", className)} role="status" aria-live="polite">
        <div className="space-y-3">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-80 max-w-full rounded-lg" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-2xl border border-border/70 bg-card/50 p-4"
            >
              <Skeleton className="mb-4 size-10 rounded-xl" />
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-border/70 bg-card/40 p-4">
          <LoadingState variant="table" rows={5} />
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={cn(
          "space-y-3 rounded-2xl border border-border/70 bg-card/50 p-5",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-[40vh] flex-col items-center justify-center gap-4 py-16",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="relative flex flex-col items-center gap-4">
        <div className="pointer-events-none absolute inset-0 -m-10 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_70%)] blur-xl" />
        <SpinnerMark size="lg" />
        <div className="relative text-center">
          <p className="text-sm font-medium tracking-tight text-foreground">
            {label}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Fetching the latest records
          </p>
        </div>
      </div>
    </div>
  );
}

export function PageLoader({
  label = "Preparing workspace",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-h-[60vh] items-center justify-center overflow-hidden px-4",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-1/4 mx-auto h-64 w-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_70%)] blur-2xl" />
        <div className="auth-grid absolute inset-0 opacity-30 dark:opacity-45" />
      </div>

      <div className="relative flex flex-col items-center gap-5 rounded-3xl border border-border/70 bg-card/70 px-8 py-7 shadow-[0_20px_50px_-30px_color-mix(in_oklch,var(--primary)_45%,transparent)] backdrop-blur-md">
        <SpinnerMark size="lg" />
        <div className="text-center">
          <p className="font-heading text-sm font-semibold tracking-tight">
            {label}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PATRI Manufacturing ERP
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="patri-loader-dot size-1.5 rounded-full bg-primary" />
          <span className="patri-loader-dot size-1.5 rounded-full bg-primary [animation-delay:160ms]" />
          <span className="patri-loader-dot size-1.5 rounded-full bg-primary [animation-delay:320ms]" />
        </div>
      </div>
    </div>
  );
}
