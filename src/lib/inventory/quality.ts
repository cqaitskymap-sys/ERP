import type { InventoryQualityStatus, InventoryStatus } from "@/types/inventory";
import type { Permission } from "@/types/permissions";

export const QUALITY_TRANSITIONS: Record<string, InventoryQualityStatus[]> = {
  quarantine: ["under_testing", "rejected", "blocked"],
  under_testing: ["approved", "rejected", "quarantine", "blocked"],
  approved: ["blocked", "expired"],
  rejected: ["blocked"],
  blocked: ["approved", "quarantine", "under_testing"],
  returned: ["quarantine", "under_testing", "rejected", "blocked"],
  expired: ["blocked"],
};

export const INVENTORY_STATUS_TRANSITIONS: Record<string, InventoryStatus[]> = {
  available: ["reserved", "allocated", "on_hold", "blocked", "expired", "consumed", "closed"],
  reserved: ["available", "allocated", "picked", "consumed", "on_hold", "blocked"],
  allocated: ["reserved", "picked", "available", "on_hold", "blocked"],
  picked: ["packed", "available", "on_hold"],
  packed: ["dispatched", "picked"],
  dispatched: ["in_transit", "delivered"],
  in_transit: ["delivered", "on_hold"],
  delivered: ["closed"],
  on_hold: ["available", "blocked", "expired"],
  blocked: ["available", "on_hold"],
  expired: ["blocked", "closed"],
  consumed: ["closed"],
  closed: [],
};

export function allowedQualityTransitions(current: string) {
  return QUALITY_TRANSITIONS[current] ?? [];
}

export function canTransitionQuality(current: string, next: string) {
  if (current === next) return false;
  return allowedQualityTransitions(current).includes(next as InventoryQualityStatus);
}

export function permissionForQualityTransition(next: string): Permission {
  if (next === "approved") return "inventory:release";
  if (next === "rejected") return "inventory:reject";
  if (next === "blocked" || next === "expired") return "inventory:block";
  if (next === "quarantine" || next === "under_testing") {
    return next === "under_testing" ? "quality:update" : "inventory:unblock";
  }
  return "inventory:update";
}

export function qualityLedgerType(previous: string, next: string) {
  if (next === "approved") return "RELEASE";
  if (next === "rejected") return "REJECTION";
  if (next === "blocked") return "BLOCK";
  if (previous === "blocked" && next !== "blocked") return "UNBLOCK";
  if (next === "expired") return "EXPIRY";
  return "RELEASE";
}

export function qualityAuditAction(next: string) {
  if (next === "approved") return "RELEASE";
  if (next === "rejected") return "REJECT";
  if (next === "blocked") return "BLOCK";
  if (next === "expired") return "EXPIRE";
  if (next === "under_testing") return "TEST";
  return "UNBLOCK";
}

export function inventoryStatusForQuality(quality: string): InventoryStatus {
  if (quality === "blocked") return "blocked";
  if (quality === "expired") return "expired";
  if (quality === "rejected" || quality === "returned" || quality === "quarantine" || quality === "under_testing") {
    return "on_hold";
  }
  return "available";
}

export const ISSUABLE_QUALITY = new Set(["approved"]);
export const ISSUABLE_INVENTORY = new Set(["available"]);
export const BLOCKED_ISSUE_QUALITY = new Set(["rejected", "blocked", "expired", "quarantine", "under_testing", "returned"]);
