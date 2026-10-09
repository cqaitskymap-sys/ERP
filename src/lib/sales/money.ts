import type { SalesMoneyBreakdown } from "@/types/sales";

export function money(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

export function calculateLineTotal(input: {
  quantity: unknown;
  unitPrice: unknown;
  discount?: unknown;
  tax?: unknown;
  freight?: unknown;
  otherCharges?: unknown;
}) {
  const quantity = money(input.quantity);
  const unitPrice = money(input.unitPrice);
  const discount = money(input.discount);
  const tax = money(input.tax);
  const freight = money(input.freight);
  const otherCharges = money(input.otherCharges);
  if (quantity < 0 || unitPrice < 0 || discount < 0 || tax < 0 || freight < 0 || otherCharges < 0) {
    throw new Error("Monetary values cannot be negative.");
  }
  const base = money(quantity * unitPrice);
  return money(base - discount + tax + freight + otherCharges);
}

export function calculateDocumentTotals(
  lines: Array<{
    quantity?: unknown;
    unitPrice?: unknown;
    discount?: unknown;
    tax?: unknown;
    freight?: unknown;
    otherCharges?: unknown;
    lineTotal?: unknown;
  }>
): SalesMoneyBreakdown {
  return lines.reduce<SalesMoneyBreakdown>(
    (totals, line) => {
      const quantity = money(line.quantity);
      const unitPrice = money(line.unitPrice);
      const discount = money(line.discount);
      const tax = money(line.tax);
      const freight = money(line.freight);
      const otherCharges = money(line.otherCharges);
      const subtotal = money(quantity * unitPrice);
      const lineTotal =
        line.lineTotal === undefined || line.lineTotal === null
          ? calculateLineTotal({
              quantity,
              unitPrice,
              discount,
              tax,
              freight,
              otherCharges,
            })
          : money(line.lineTotal);
      return {
        subtotal: money(totals.subtotal + subtotal),
        discount: money(totals.discount + discount),
        tax: money(totals.tax + tax),
        freight: money(totals.freight + freight),
        otherCharges: money(totals.otherCharges + otherCharges),
        grandTotal: money(totals.grandTotal + lineTotal),
      };
    },
    { subtotal: 0, discount: 0, tax: 0, freight: 0, otherCharges: 0, grandTotal: 0 }
  );
}

export function discountPercent(subtotal: unknown, discount: unknown) {
  const base = money(subtotal);
  if (base <= 0) return 0;
  return money((money(discount) / base) * 100);
}

export function calculateFulfilmentPercent(ordered: unknown, fulfilled: unknown) {
  const orderedQty = money(ordered);
  if (orderedQty <= 0) return 0;
  return money(Math.min(100, (money(fulfilled) / orderedQty) * 100));
}
