import { isInventoryExpired } from "@/lib/inventory/expiry";
import {
  BLOCKED_ISSUE_QUALITY,
  ISSUABLE_INVENTORY,
  ISSUABLE_QUALITY,
} from "@/lib/inventory/quality";
import { roundQuantity } from "@/lib/inventory/keys";
import type { FefoCandidate } from "@/types/inventory";

export function issueBlockReason(
  row: Pick<
    FefoCandidate,
    "qualityStatus" | "inventoryStatus" | "availableQuantity" | "expiryDate"
  >,
  now = new Date()
) {
  if (BLOCKED_ISSUE_QUALITY.has(String(row.qualityStatus))) {
    return `Stock with quality status "${row.qualityStatus}" cannot be issued.`;
  }
  if (!ISSUABLE_QUALITY.has(String(row.qualityStatus))) {
    return "Only approved stock can be issued.";
  }
  if (!ISSUABLE_INVENTORY.has(String(row.inventoryStatus))) {
    return `Inventory status "${row.inventoryStatus}" is not available for issue.`;
  }
  if (isInventoryExpired(row.expiryDate, now)) {
    return "Expired stock cannot be issued.";
  }
  if (roundQuantity(row.availableQuantity) <= 0) {
    return "Insufficient available quantity.";
  }
  return null;
}

export function isIssuable(row: FefoCandidate, now = new Date()) {
  return issueBlockReason(row, now) === null;
}

export function assertSufficientQuantity(available: unknown, requested: unknown) {
  const have = roundQuantity(available);
  const need = roundQuantity(requested);
  if (need <= 0) return "Quantity must be greater than zero.";
  if (have + 1e-9 < need) return "Insufficient available quantity.";
  return null;
}
