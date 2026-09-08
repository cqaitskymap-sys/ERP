import { calculateExpiryStatus, daysUntil, validateShelfLife } from "@/lib/inventory/expiry";
import { selectFefoBatches } from "@/lib/inventory/fefo";
import { DEFAULT_EXPIRY_THRESHOLDS } from "@/lib/logistics/config";
import type { FefoCandidate } from "@/types/inventory";

export { calculateExpiryStatus, validateShelfLife };

export function selectFEFOInventory(
  rows: FefoCandidate[],
  quantity: number,
  restrictions: {
    warehouseId?: string;
    locationId?: string;
    batchNumber?: string;
    minRemainingDays?: number;
    now?: Date;
  } = {}
) {
  return selectFefoBatches(rows, quantity, restrictions);
}

export function detectTemperatureExcursion(temperature: number, minimum?: number, maximum?: number) {
  const min = minimum === undefined || Number.isNaN(Number(minimum)) ? undefined : Number(minimum);
  const max = maximum === undefined || Number.isNaN(Number(maximum)) ? undefined : Number(maximum);
  if (min !== undefined && temperature < min) return { excursion: true, direction: "below" as const, minimum: min, maximum: max };
  if (max !== undefined && temperature > max) return { excursion: true, direction: "above" as const, minimum: min, maximum: max };
  return { excursion: false, direction: null as null, minimum: min, maximum: max };
}

export function calculateTemperatureExposure(
  records: Array<{ timestamp?: string; temperature?: number }>,
  minimum?: number,
  maximum?: number
) {
  const sorted = [...records].sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
  let minutes = 0;
  let count = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    const detected = detectTemperatureExcursion(Number(current.temperature), minimum, maximum);
    if (!detected.excursion) continue;
    count += 1;
    const next = sorted[index + 1];
    if (current.timestamp && next?.timestamp) {
      minutes += Math.max(0, (new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime()) / 60000);
    }
  }
  return { outOfRangeReadings: count, estimatedMinutes: Math.round(minutes) };
}

export function calculateInventoryVariance(systemQuantity: number, countedQuantity: number) {
  return Math.round((Number(countedQuantity) - Number(systemQuantity)) * 1000) / 1000;
}

export function calculateWarehouseUtilization(locations: Array<{ capacity?: unknown; used?: unknown; status?: unknown }>) {
  const total = locations.reduce((sum, row) => sum + Number(row.capacity || 0), 0);
  const used = locations.reduce((sum, row) => sum + Number(row.used || 0), 0);
  const blocked = locations.filter((row) => String(row.status) === "blocked").length;
  const full = locations.filter((row) => String(row.status) === "full").length;
  const available = locations.filter((row) => String(row.status) === "available" || !row.status).length;
  return {
    totalCapacity: total,
    usedCapacity: used,
    availableCapacity: Math.max(0, total - used),
    utilizationPercent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0,
    blockedLocations: blocked,
    fullLocations: full,
    availableLocations: available,
  };
}

export function remainingDays(expiryDate: unknown, now = new Date()) {
  return daysUntil(expiryDate, now);
}

export function expiryWindows() {
  return DEFAULT_EXPIRY_THRESHOLDS.windows;
}
