export const EXPIRY_WINDOWS_DAYS = [30, 60, 90] as const;

export type ExpiryWindow = (typeof EXPIRY_WINDOWS_DAYS)[number];
export type ExpiryState = "expired" | "expiring_30" | "expiring_60" | "expiring_90" | "valid" | "none";

export function daysUntil(dateValue: unknown, now = new Date()) {
  if (!dateValue) return null;
  const date = new Date(String(dateValue));
  if (Number.isNaN(date.getTime())) return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - start.getTime()) / 86_400_000);
}

export function classifyExpiry(dateValue: unknown, now = new Date()): ExpiryState {
  const days = daysUntil(dateValue, now);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= 30) return "expiring_30";
  if (days <= 60) return "expiring_60";
  if (days <= 90) return "expiring_90";
  return "valid";
}

export function expiryLabel(state: ExpiryState) {
  if (state === "expired") return "Expired";
  if (state === "expiring_30") return "Expiring in 30 days";
  if (state === "expiring_60") return "Expiring in 60 days";
  if (state === "expiring_90") return "Expiring in 90 days";
  if (state === "valid") return "Valid";
  return "No date";
}

export function isExpiringSoon(dateValue: unknown, window: ExpiryWindow = 90) {
  const days = daysUntil(dateValue);
  return days !== null && days >= 0 && days <= window;
}
