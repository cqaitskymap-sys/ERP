import { strictEqual, ok, notEqual } from "node:assert/strict";
import { issueBlockReason } from "@/lib/inventory/eligibility";
import { classifyInventoryExpiry, daysUntil } from "@/lib/inventory/expiry";
import { selectFefoBatches, sortFefoCandidates } from "@/lib/inventory/fefo";
import { balanceKey, balanceLifecycleStatus, roundQuantity } from "@/lib/inventory/keys";
import { canTransitionQuality } from "@/lib/inventory/quality";
import type { FefoCandidate } from "@/types/inventory";

function daysFromNow(days: number) {
  const date = new Date("2026-09-05T00:00:00.000Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function candidate(overrides: Partial<FefoCandidate> = {}): FefoCandidate {
  return {
    id: overrides.id || "b1",
    itemId: "MAT-1",
    itemType: "material",
    batchNumber: overrides.batchNumber || "B001",
    warehouseId: "WH-1",
    locationId: "LOC-1",
    qualityStatus: "approved",
    inventoryStatus: "available",
    availableQuantity: 10,
    expiryDate: daysFromNow(40),
    ...overrides,
  };
}

export function runInventorySelfTests() {
  const now = new Date("2026-09-05T00:00:00.000Z");

  strictEqual(classifyInventoryExpiry(daysFromNow(-1), now), "expired");
  strictEqual(classifyInventoryExpiry(daysFromNow(5), now), "expiring_7");
  strictEqual(classifyInventoryExpiry(daysFromNow(20), now), "expiring_30");
  strictEqual(classifyInventoryExpiry(daysFromNow(45), now), "expiring_60");
  strictEqual(classifyInventoryExpiry(daysFromNow(80), now), "expiring_90");
  strictEqual(classifyInventoryExpiry(daysFromNow(120), now), "valid");
  ok((daysUntil(daysFromNow(7), now) || 0) <= 7);

  ok(canTransitionQuality("quarantine", "under_testing"));
  ok(canTransitionQuality("under_testing", "approved"));
  ok(canTransitionQuality("quarantine", "rejected"));
  ok(canTransitionQuality("approved", "blocked"));
  ok(!canTransitionQuality("quarantine", "approved"));
  ok(!canTransitionQuality("rejected", "approved"));

  const expired = candidate({ expiryDate: daysFromNow(-2), batchNumber: "EXP" });
  const rejected = candidate({ qualityStatus: "rejected", batchNumber: "REJ" });
  const blocked = candidate({ qualityStatus: "blocked", batchNumber: "BLK" });
  const late = candidate({ expiryDate: daysFromNow(90), batchNumber: "LATE", availableQuantity: 5 });
  const early = candidate({ expiryDate: daysFromNow(12), batchNumber: "EARLY", availableQuantity: 4 });
  const mid = candidate({ expiryDate: daysFromNow(30), batchNumber: "MID", availableQuantity: 8 });

  ok(issueBlockReason(expired, now));
  ok(issueBlockReason(rejected, now));
  ok(issueBlockReason(blocked, now));
  ok(issueBlockReason(candidate({ inventoryStatus: "on_hold" }), now));
  strictEqual(issueBlockReason(early, now), null);

  const sorted = sortFefoCandidates([late, early, mid, expired, rejected], now);
  strictEqual(sorted[0]?.batchNumber, "EARLY");
  strictEqual(sorted[1]?.batchNumber, "MID");
  strictEqual(sorted[2]?.batchNumber, "LATE");

  const selected = selectFefoBatches([late, early, mid, expired, rejected], 10, { now });
  strictEqual(selected.allocations[0]?.batchNumber, "EARLY");
  strictEqual(selected.allocations[0]?.allocatedQuantity, 4);
  strictEqual(selected.allocations[1]?.batchNumber, "MID");
  strictEqual(roundQuantity(selected.remainingQuantity), 0);

  const insufficient = selectFefoBatches([early], 20, { now });
  ok(insufficient.remainingQuantity > 0);

  const keyA = balanceKey({
    itemType: "material",
    itemId: "A",
    batchNumber: "b001",
    warehouseId: "W1",
    locationId: "L1",
    qualityStatus: "approved",
  });
  const keyB = balanceKey({
    itemType: "material",
    itemId: "A",
    batchNumber: "B001",
    warehouseId: "W1",
    locationId: "L1",
    qualityStatus: "quarantine",
  });
  notEqual(keyA, keyB);
  ok(keyA.includes("B001"));
  strictEqual(balanceLifecycleStatus(0, 4), "active");
  strictEqual(balanceLifecycleStatus(0, 0), "closed");
  strictEqual(balanceLifecycleStatus(3, 0), "active");

  return "inventory self-tests passed";
}

console.log(runInventorySelfTests());
