import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "critical"
  | "hold";

const toneClass: Record<StatusTone, string> = {
  neutral: "border-transparent bg-muted text-muted-foreground",
  info: "border-transparent bg-sky-500/12 text-sky-700 dark:text-sky-300",
  success: "border-transparent bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  warning: "border-transparent bg-amber-500/12 text-amber-700 dark:text-amber-300",
  critical: "border-transparent bg-rose-500/12 text-rose-700 dark:text-rose-300",
  hold: "border-transparent bg-violet-500/12 text-violet-700 dark:text-violet-300",
};

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(toneClass[tone], className)}>
      {label}
    </Badge>
  );
}
