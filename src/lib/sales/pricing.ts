import { queryMasterDocuments, type MasterRecord } from "@/lib/masters/firestore";
import { SALES_COLLECTIONS } from "@/lib/sales/collections";
import { money, discountPercent } from "@/lib/sales/money";
import { text } from "@/lib/sales/helpers";

export function isPriceRuleEffective(rule: Record<string, unknown>, onDate: string) {
  const from = text(rule.effectiveFrom);
  const to = text(rule.effectiveTo);
  if (from && onDate < from) return false;
  if (to && onDate > to) return false;
  return true;
}

export function selectTierPrice(
  rules: Array<Record<string, unknown>>,
  productId: string,
  quantity: number,
  onDate: string,
  packSize?: string
) {
  const candidates = rules
    .filter((rule) => text(rule.productId) === productId)
    .filter((rule) => !packSize || !text(rule.packSize) || text(rule.packSize) === packSize)
    .filter((rule) => isPriceRuleEffective(rule, onDate))
    .filter((rule) => quantity >= money(rule.minQuantity || 0))
    .filter((rule) => !rule.maxQuantity || quantity <= money(rule.maxQuantity))
    .sort((a, b) => money(b.minQuantity) - money(a.minQuantity));
  return candidates[0] || null;
}

export function requiresDiscountApproval(
  subtotal: number,
  discount: number,
  thresholdPercent: number
) {
  return discountPercent(subtotal, discount) > money(thresholdPercent);
}

export async function loadActivePriceListForCustomer(
  customerId: string,
  idToken: string,
  onDate = new Date().toISOString().slice(0, 10)
) {
  const rows = await queryMasterDocuments(SALES_COLLECTIONS.priceLists, idToken, {
    filters: [
      { field: "customerId", value: customerId },
      { field: "status", value: "active" },
    ],
    limit: 20,
  });
  return (
    rows.find((row) => {
      const from = text(row.effectiveFrom);
      const to = text(row.effectiveTo);
      if (from && onDate < from) return false;
      if (to && onDate > to) return false;
      return true;
    }) || null
  );
}

export async function loadPriceRules(priceListId: string, idToken: string) {
  return queryMasterDocuments(SALES_COLLECTIONS.priceRules, idToken, {
    filters: [{ field: "priceListId", value: priceListId }],
    limit: 200,
  });
}

export function historicalPriceRevision(options: {
  previous: MasterRecord | null;
  next: Record<string, unknown>;
  revisedBy: string;
}) {
  return {
    previousGrandTotal: options.previous ? money(options.previous.grandTotal) : null,
    nextGrandTotal: money(options.next.grandTotal),
    revisedBy: options.revisedBy,
    revisedAt: new Date().toISOString(),
  };
}
