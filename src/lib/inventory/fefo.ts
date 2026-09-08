import { isIssuable } from "@/lib/inventory/eligibility";
import { roundQuantity } from "@/lib/inventory/keys";
import type { FefoCandidate, FefoSelection } from "@/types/inventory";

export function sortFefoCandidates(rows: FefoCandidate[], now = new Date()) {
  return [...rows]
    .filter((row) => isIssuable(row, now))
    .sort((left, right) => {
      const leftExpiry = left.expiryDate ? new Date(left.expiryDate).getTime() : Number.POSITIVE_INFINITY;
      const rightExpiry = right.expiryDate ? new Date(right.expiryDate).getTime() : Number.POSITIVE_INFINITY;
      if (leftExpiry !== rightExpiry) return leftExpiry - rightExpiry;
      return String(left.batchNumber).localeCompare(String(right.batchNumber));
    });
}

export function selectFefoBatches(
  rows: FefoCandidate[],
  quantity: number,
  restrictions: {
    warehouseId?: string;
    locationId?: string;
    batchNumber?: string;
    lotNumber?: string;
    minRemainingDays?: number;
    now?: Date;
  } = {}
): FefoSelection {
  const need = roundQuantity(quantity);
  const now = restrictions.now ?? new Date();
  const eligible = sortFefoCandidates(rows, now).filter((row) => {
    if (restrictions.warehouseId && row.warehouseId !== restrictions.warehouseId) return false;
    if (restrictions.locationId && row.locationId !== restrictions.locationId) return false;
    if (restrictions.batchNumber && row.batchNumber !== restrictions.batchNumber) return false;
    if (restrictions.lotNumber && row.lotNumber !== restrictions.lotNumber) return false;
    if (restrictions.minRemainingDays) {
      const expiry = row.expiryDate ? new Date(row.expiryDate).getTime() : Number.NaN;
      if (!Number.isNaN(expiry)) {
        const days = Math.round((expiry - now.getTime()) / 86_400_000);
        if (days < restrictions.minRemainingDays) return false;
      }
    }
    return true;
  });

  const allocations: FefoSelection["allocations"] = [];
  let remaining = need;
  for (const row of eligible) {
    if (remaining <= 0) break;
    const take = Math.min(roundQuantity(row.availableQuantity), remaining);
    if (take <= 0) continue;
    allocations.push({ ...row, allocatedQuantity: take });
    remaining = roundQuantity(remaining - take);
  }

  return { allocations, remainingQuantity: remaining };
}
