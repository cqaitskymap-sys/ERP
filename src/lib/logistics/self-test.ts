import { ok, strictEqual } from "node:assert/strict";
import { calculateExpiryStatus, validateShelfLife } from "@/lib/inventory/expiry";
import { selectFefoBatches } from "@/lib/inventory/fefo";
import { electronicSignature } from "@/lib/logistics/helpers";
import {
  calculateInventoryVariance,
  calculateTemperatureExposure,
  calculateWarehouseUtilization,
  detectTemperatureExcursion,
  selectFEFOInventory,
} from "@/lib/logistics/scoring";
import {
  EXCURSION_TRANSITIONS,
  PICK_TRANSITIONS,
  RETURN_TRANSITIONS,
  SHIPMENT_TRANSITIONS,
  canTransition,
} from "@/lib/logistics/status";
import { formatDocumentNumber } from "@/lib/masters/numbering";
import type { SessionPayload } from "@/types/auth";
import type { FefoCandidate } from "@/types/inventory";

function daysFromNow(days: number, now = new Date("2026-09-05T00:00:00.000Z")) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function candidate(overrides: Partial<FefoCandidate> = {}): FefoCandidate {
  return {
    id: overrides.id || "b1",
    itemId: "PRD-1",
    itemType: "product",
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

export function runLogisticsSelfTests() {
  const now = new Date("2026-09-05T00:00:00.000Z");

  const expired = calculateExpiryStatus(daysFromNow(-1, now), now);
  strictEqual(expired.status, "expired");
  const critical = calculateExpiryStatus(daysFromNow(10, now), now);
  strictEqual(critical.status, "critical");
  const near = calculateExpiryStatus(daysFromNow(60, now), now);
  strictEqual(near.status, "near_expiry");
  const valid = calculateExpiryStatus(daysFromNow(200, now), now);
  strictEqual(valid.status, "valid");

  const shortShelf = validateShelfLife(daysFromNow(200, now), 12, now);
  ok(!shortShelf.allowed);
  const longShelf = validateShelfLife(daysFromNow(400, now), 12, now);
  ok(longShelf.allowed);

  const early = candidate({ expiryDate: daysFromNow(20, now), batchNumber: "EARLY", availableQuantity: 5 });
  const late = candidate({ expiryDate: daysFromNow(180, now), batchNumber: "LATE", availableQuantity: 8 });
  const expiredBatch = candidate({ expiryDate: daysFromNow(-3, now), batchNumber: "EXP" });
  const rejected = candidate({ qualityStatus: "rejected", batchNumber: "REJ" });
  const hold = candidate({ qualityStatus: "blocked", batchNumber: "HOLD" });

  const fefo = selectFEFOInventory([late, early, expiredBatch, rejected, hold], 6, { now });
  strictEqual(fefo.allocations[0]?.batchNumber, "EARLY");
  strictEqual(fefo.allocations[0]?.allocatedQuantity, 5);
  strictEqual(fefo.allocations[1]?.batchNumber, "LATE");
  ok(!fefo.allocations.some((row) => ["EXP", "REJ", "HOLD"].includes(row.batchNumber)));

  const shelfRestricted = selectFefoBatches([early, late], 5, { now, minRemainingDays: 90 });
  strictEqual(shelfRestricted.allocations[0]?.batchNumber, "LATE");
  ok(!shelfRestricted.allocations.some((row) => row.batchNumber === "EARLY"));

  ok(detectTemperatureExcursion(-2, 2, 8).excursion);
  ok(detectTemperatureExcursion(12, 2, 8).excursion);
  ok(!detectTemperatureExcursion(5, 2, 8).excursion);

  const exposure = calculateTemperatureExposure(
    [
      { timestamp: "2026-09-05T10:00:00.000Z", temperature: 10 },
      { timestamp: "2026-09-05T10:30:00.000Z", temperature: 11 },
      { timestamp: "2026-09-05T11:00:00.000Z", temperature: 5 },
    ],
    2,
    8
  );
  strictEqual(exposure.outOfRangeReadings, 2);
  ok(exposure.estimatedMinutes >= 30);

  strictEqual(calculateInventoryVariance(10, 8), -2);
  strictEqual(calculateInventoryVariance(10, 10), 0);

  const utilization = calculateWarehouseUtilization([
    { capacity: 100, used: 40, status: "available" },
    { capacity: 50, used: 50, status: "full" },
    { capacity: 20, used: 0, status: "blocked" },
  ]);
  strictEqual(utilization.utilizationPercent, 52.9);
  strictEqual(utilization.blockedLocations, 1);
  strictEqual(utilization.fullLocations, 1);

  ok(canTransition(PICK_TRANSITIONS, "picked", "verified"));
  ok(!canTransition(PICK_TRANSITIONS, "cancelled", "picked"));
  ok(canTransition(SHIPMENT_TRANSITIONS, "packed", "dispatched"));
  ok(!canTransition(SHIPMENT_TRANSITIONS, "delivered", "dispatched"));
  ok(!canTransition(SHIPMENT_TRANSITIONS, "cancelled", "dispatched"));
  ok(canTransition(RETURN_TRANSITIONS, "received", "quarantine"));
  ok(!canTransition(RETURN_TRANSITIONS, "received", "accepted"));
  ok(!canTransition(RETURN_TRANSITIONS, "requested", "accepted"));
  ok(!canTransition(EXCURSION_TRANSITIONS, "closed", "released"));
  ok(!canTransition(EXCURSION_TRANSITIONS, "potential", "released"));

  strictEqual(
    formatDocumentNumber({ prefix: "STK-MOV", separator: "-", financialYear: "2026", currentNumber: 1, numberLength: 5 }),
    "STK-MOV-2026-00001"
  );
  strictEqual(
    formatDocumentNumber({ prefix: "PICK", separator: "-", financialYear: "2026", currentNumber: 1, numberLength: 5 }),
    "PICK-2026-00001"
  );
  strictEqual(
    formatDocumentNumber({ prefix: "PACK", separator: "-", financialYear: "2026", currentNumber: 1, numberLength: 5 }),
    "PACK-2026-00001"
  );
  strictEqual(
    formatDocumentNumber({ prefix: "SHP", separator: "-", financialYear: "2026", currentNumber: 1, numberLength: 5 }),
    "SHP-2026-00001"
  );
  strictEqual(
    formatDocumentNumber({ prefix: "WRET", separator: "-", financialYear: "2026", currentNumber: 1, numberLength: 5 }),
    "WRET-2026-00001"
  );
  strictEqual(
    formatDocumentNumber({ prefix: "CNT", separator: "-", financialYear: "2026", currentNumber: 1, numberLength: 5 }),
    "CNT-2026-00001"
  );
  strictEqual(
    formatDocumentNumber({ prefix: "TEMP-EXC", separator: "-", financialYear: "2026", currentNumber: 1, numberLength: 5 }),
    "TEMP-EXC-2026-00001"
  );

  const signature = electronicSignature(
    { uid: "qa-user", email: "qa@example.com", role: "qa" } as SessionPayload,
    "excursion_decision",
    "Impact assessed"
  );
  ok(signature.signatureReference);
  ok(!("password" in signature));
  strictEqual(signature.signedBy, "qa-user");

  return "logistics self-tests passed";
}

console.log(runLogisticsSelfTests());
