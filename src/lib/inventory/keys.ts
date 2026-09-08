import type { InventoryBalanceKeyInput } from "@/types/inventory";

export function normalizeToken(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeBatchNumber(value: unknown) {
  return normalizeToken(value).toUpperCase();
}

export function itemCollection(itemType: unknown) {
  return String(itemType) === "material" ? "materials" : "products";
}

export function itemIdField(itemType: unknown) {
  return String(itemType) === "material" ? "materialId" : "productId";
}

export function balanceKey(input: InventoryBalanceKeyInput) {
  return [
    normalizeToken(input.itemType).toLowerCase(),
    normalizeToken(input.itemId),
    normalizeBatchNumber(input.batchNumber),
    normalizeToken(input.warehouseId),
    normalizeToken(input.locationId),
    normalizeToken(input.qualityStatus).toLowerCase(),
  ].join("__");
}

export function searchIndex(...parts: unknown[]) {
  return parts
    .map((part) => normalizeToken(part).toLowerCase())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameIndex(value: unknown) {
  return normalizeToken(value).toLowerCase();
}

export function roundQuantity(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 10000) / 10000;
}

export function isPositiveQuantity(value: unknown) {
  return roundQuantity(value) > 0;
}
