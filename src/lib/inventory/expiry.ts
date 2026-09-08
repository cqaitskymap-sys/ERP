import {
  INVENTORY_EXPIRY_WINDOWS,
  type InventoryExpiryState,
  type InventoryExpiryWindow,
} from "@/types/inventory";

export const INVENTORY_EXPIRY_WINDOWS_DAYS = INVENTORY_EXPIRY_WINDOWS;

export function daysUntil(dateValue: unknown, now = new Date()) {
  if (!dateValue) return null;
  const date = new Date(String(dateValue));
  if (Number.isNaN(date.getTime())) return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - start.getTime()) / 86_400_000);
}

export function classifyInventoryExpiry(
  dateValue: unknown,
  now = new Date()
): InventoryExpiryState {
  const days = daysUntil(dateValue, now);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= 7) return "expiring_7";
  if (days <= 30) return "expiring_30";
  if (days <= 60) return "expiring_60";
  if (days <= 90) return "expiring_90";
  return "valid";
}

export function inventoryExpiryLabel(state: InventoryExpiryState) {
  if (state === "expired") return "Expired";
  if (state === "expiring_7") return "Expiring in 7 days";
  if (state === "expiring_30") return "Expiring in 30 days";
  if (state === "expiring_60") return "Expiring in 60 days";
  if (state === "expiring_90") return "Expiring in 90 days";
  if (state === "valid") return "Valid";
  return "No date";
}

export function isInventoryExpiringSoon(
  dateValue: unknown,
  window: InventoryExpiryWindow = 90,
  now = new Date()
) {
  const days = daysUntil(dateValue, now);
  return days !== null && days >= 0 && days <= window;
}

export function isInventoryExpired(dateValue: unknown, now = new Date()) {
  const days = daysUntil(dateValue, now);
  return days !== null && days < 0;
}

export function calculateExpiryStatus(
  expiryDate: unknown,
  now = new Date(),
  thresholds: { near?: number; critical?: number } = {}
) {
  const near = Number(thresholds.near ?? 90);
  const critical = Number(thresholds.critical ?? 30);
  const daysRemaining = daysUntil(expiryDate, now);
  if (daysRemaining === null) return { status: "valid" as const, daysRemaining: null as number | null };
  if (daysRemaining < 0) return { status: "expired" as const, daysRemaining };
  if (daysRemaining <= critical) return { status: "critical" as const, daysRemaining };
  if (daysRemaining <= near) return { status: "near_expiry" as const, daysRemaining };
  return { status: "valid" as const, daysRemaining };
}

export function validateShelfLife(
  expiryDate: unknown,
  minRemainingMonths: number,
  now = new Date()
) {
  const requiredDays = Math.max(0, Number(minRemainingMonths || 0) * 30);
  const daysRemaining = daysUntil(expiryDate, now);
  if (!requiredDays) return { allowed: true, daysRemaining, requiredDays };
  if (daysRemaining === null) return { allowed: false, daysRemaining, requiredDays };
  return { allowed: daysRemaining >= requiredDays, daysRemaining, requiredDays };
}
