import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import { isIssuable } from "@/lib/inventory/eligibility";
import { selectFefoBatches } from "@/lib/inventory/fefo";
import { roundQuantity } from "@/lib/inventory/keys";
import { DEFAULT_COUNT_QUARANTINE_AS_AVAILABLE } from "@/lib/production/config";
import { queryMasterDocuments } from "@/lib/masters/firestore";
import type { MaterialAvailabilityLine, MaterialRequirementLine } from "@/types/production";
import type { FefoCandidate } from "@/types/inventory";

export async function checkMaterialAvailability(
  lines: MaterialRequirementLine[],
  idToken: string,
  options?: { countQuarantine?: boolean; warehouseId?: string }
): Promise<MaterialAvailabilityLine[]> {
  const countQuarantine = options?.countQuarantine ?? DEFAULT_COUNT_QUARANTINE_AS_AVAILABLE;
  const result: MaterialAvailabilityLine[] = [];
  for (const line of lines) {
    const balances = await queryMasterDocuments(INVENTORY_COLLECTIONS.balances, idToken, {
      filters: [{ field: "itemId", value: line.materialId }],
      limit: 200,
    });
    let approved = 0;
    let quarantine = 0;
    let blocked = 0;
    let rejected = 0;
    for (const row of balances) {
      if (options?.warehouseId && String(row.warehouseId) !== options.warehouseId) continue;
      const qty = roundQuantity(row.availableQuantity);
      const quality = String(row.qualityStatus || "");
      if (quality === "approved") approved += qty;
      else if (quality === "quarantine") quarantine += qty;
      else if (quality === "blocked") blocked += qty;
      else if (quality === "rejected") rejected += qty;
    }
    const available = roundQuantity(approved + (countQuarantine ? quarantine : 0));
    const shortage = roundQuantity(Math.max(0, line.requiredQuantity - available));
    result.push({
      ...line,
      availableQuantity: available,
      approvedQuantity: roundQuantity(approved),
      quarantineQuantity: roundQuantity(quarantine),
      blockedQuantity: roundQuantity(blocked),
      rejectedQuantity: roundQuantity(rejected),
      shortage,
      status: shortage > 0 ? "short" : "ok",
      suggestedAction:
        shortage > 0
          ? "Procurement Required"
          : "Approved stock is sufficient. Do not consume until dispensing execution.",
    });
  }
  return result;
}

export async function suggestFefoAllocations(
  materialId: string,
  quantity: number,
  idToken: string,
  warehouseId?: string
) {
  const balances = await queryMasterDocuments(INVENTORY_COLLECTIONS.balances, idToken, {
    filters: [{ field: "itemId", value: materialId }],
    limit: 200,
  });
  const candidates: FefoCandidate[] = balances.map((row) => ({
    id: String(row.id),
    itemId: String(row.itemId || materialId),
    itemType: String(row.itemType || "material"),
    batchNumber: String(row.batchNumber || ""),
    warehouseId: String(row.warehouseId || ""),
    locationId: String(row.locationId || ""),
    qualityStatus: String(row.qualityStatus || ""),
    inventoryStatus: String(row.inventoryStatus || ""),
    availableQuantity: Number(row.availableQuantity || 0),
    expiryDate: String(row.expiryDate || ""),
    inventoryBatchId: String(row.inventoryBatchId || row.id),
  }));
  return selectFefoBatches(
    candidates.filter((row) => isIssuable(row)),
    quantity,
    { warehouseId }
  );
}
