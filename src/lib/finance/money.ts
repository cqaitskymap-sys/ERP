/**
 * Safe decimal helpers for accounting.
 * Internally work in integer cents to avoid float drift on balancing checks.
 */

export function toCents(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100);
}

export function fromCents(cents: unknown): number {
  const value = Number(cents);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value) / 100;
}

export function money(value: unknown): number {
  return fromCents(toCents(value));
}

export function addMoney(...values: unknown[]): number {
  return fromCents(values.reduce<number>((sum, value) => sum + toCents(value), 0));
}

export function subtractMoney(left: unknown, right: unknown): number {
  return fromCents(toCents(left) - toCents(right));
}

export function multiplyMoney(amount: unknown, factor: unknown): number {
  const a = toCents(amount);
  const f = Number(factor);
  if (!Number.isFinite(f)) return 0;
  return fromCents(Math.round(a * f));
}

export function percentOf(amount: unknown, percent: unknown): number {
  return multiplyMoney(amount, Number(percent) / 100);
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
  if ([quantity, unitPrice, discount, tax, freight, otherCharges].some((v) => v < 0)) {
    throw new Error("Monetary values cannot be negative.");
  }
  const base = multiplyMoney(quantity, unitPrice);
  return addMoney(subtractMoney(base, discount), tax, freight, otherCharges);
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
) {
  const initial = { subtotal: 0, discount: 0, tax: 0, freight: 0, otherCharges: 0, grandTotal: 0 };
  return lines.reduce((totals, line) => {
    const quantity = money(line.quantity);
    const unitPrice = money(line.unitPrice);
    const discount = money(line.discount);
    const tax = money(line.tax);
    const freight = money(line.freight);
    const otherCharges = money(line.otherCharges);
    const subtotal = multiplyMoney(quantity, unitPrice);
    const lineTotal =
      line.lineTotal === undefined || line.lineTotal === null
        ? calculateLineTotal({ quantity, unitPrice, discount, tax, freight, otherCharges })
        : money(line.lineTotal);
    return {
      subtotal: addMoney(totals.subtotal, subtotal),
      discount: addMoney(totals.discount, discount),
      tax: addMoney(totals.tax, tax),
      freight: addMoney(totals.freight, freight),
      otherCharges: addMoney(totals.otherCharges, otherCharges),
      grandTotal: addMoney(totals.grandTotal, lineTotal),
    };
  }, initial);
}

export function debitsEqualCredits(debits: unknown[], credits: unknown[]) {
  const debitCents = debits.reduce<number>((sum, value) => sum + toCents(value), 0);
  const creditCents = credits.reduce<number>((sum, value) => sum + toCents(value), 0);
  return debitCents === creditCents;
}

export function formatMoney(value: unknown, currency = "INR") {
  return `${currency} ${money(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
