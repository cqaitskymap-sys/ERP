import { DEFAULT_EXPIRY_THRESHOLDS } from "@/lib/ra/config";
import type { ExpiryStatus, ExpiryThresholds } from "@/types/ra";

export function daysUntil(dateValue: unknown, now = new Date()) {
  const raw = String(dateValue || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - now.getTime()) / 86400000);
}

export function calculateExpiryStatus(
  dateValue: unknown,
  thresholds: ExpiryThresholds = DEFAULT_EXPIRY_THRESHOLDS,
  now = new Date()
): ExpiryStatus {
  const days = daysUntil(dateValue, now);
  if (days === null) return "active";
  if (days < 0) return "expired";
  if (days <= thresholds.urgentDays || days <= thresholds.criticalDays) return "critical";
  if (days <= thresholds.soonDays) return "expiring_soon";
  return "active";
}

export function expiryLabel(status: ExpiryStatus) {
  if (status === "expired") return "Expired";
  if (status === "critical") return "Critical expiry";
  if (status === "expiring_soon") return "Expiring soon";
  return "Active";
}
