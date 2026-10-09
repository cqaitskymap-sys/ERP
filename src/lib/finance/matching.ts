import { money, percentOf, subtractMoney, addMoney } from "@/lib/finance/money";
import { text } from "@/lib/finance/helpers";

export interface MatchLineInput {
  materialId?: string;
  productId?: string;
  quantity: number;
  unitPrice: number;
  tax?: number;
  freight?: number;
  discount?: number;
  poOrderedQuantity?: number;
  receivedQuantity?: number;
  qcAcceptedQuantity?: number;
  previouslyInvoicedQuantity?: number;
  previouslyCreditedQuantity?: number;
  poUnitPrice?: number;
}

export interface MatchResult {
  matched: boolean;
  status: "matched" | "partial_match" | "exception";
  exceptions: string[];
  warnings: string[];
}

export function matchSupplierInvoiceLines(options: {
  lines: MatchLineInput[];
  qtyTolerancePercent?: number;
  priceTolerancePercent?: number;
  isServiceInvoice?: boolean;
}): MatchResult {
  const exceptions: string[] = [];
  const warnings: string[] = [];
  const qtyTol = money(options.qtyTolerancePercent ?? 0);
  const priceTol = money(options.priceTolerancePercent ?? 0);

  if (options.isServiceInvoice) {
    for (const [index, line] of options.lines.entries()) {
      if (line.poUnitPrice != null) {
        const variance = Math.abs(subtractMoney(line.unitPrice, line.poUnitPrice));
        const allowed = percentOf(line.poUnitPrice, priceTol);
        if (variance > allowed) {
          exceptions.push(`Line ${index + 1}: service price variance ${variance} exceeds tolerance.`);
        }
      }
    }
    return {
      matched: exceptions.length === 0,
      status: exceptions.length ? "exception" : "matched",
      exceptions,
      warnings,
    };
  }

  for (const [index, line] of options.lines.entries()) {
    const ordered = money(line.poOrderedQuantity);
    const received = money(line.receivedQuantity);
    const accepted = line.qcAcceptedQuantity != null ? money(line.qcAcceptedQuantity) : received;
    const previouslyInvoiced = money(line.previouslyInvoicedQuantity);
    const previouslyCredited = money(line.previouslyCreditedQuantity);
    const invoiceQty = money(line.quantity);
    const remainingBillable = Math.max(0, addMoney(subtractMoney(accepted, previouslyInvoiced), previouslyCredited));
    const qtyAllowedOver = percentOf(remainingBillable || ordered || invoiceQty, qtyTol);

    if (!ordered && !received) {
      exceptions.push(`Line ${index + 1}: missing PO/receipt quantities for three-way match.`);
      continue;
    }
    if (received <= 0) {
      exceptions.push(`Line ${index + 1}: no goods receipt quantity available.`);
    }
    if (accepted < received) {
      warnings.push(`Line ${index + 1}: QC-accepted quantity (${accepted}) is less than received (${received}).`);
    }
    if (invoiceQty > addMoney(remainingBillable, qtyAllowedOver)) {
      exceptions.push(
        `Line ${index + 1}: invoice quantity ${invoiceQty} exceeds remaining billable ${remainingBillable} (tolerance ${qtyTol}%).`
      );
    }
    if (line.poUnitPrice != null) {
      const variance = Math.abs(subtractMoney(line.unitPrice, line.poUnitPrice));
      const allowed = percentOf(line.poUnitPrice, priceTol);
      if (variance > allowed) {
        exceptions.push(`Line ${index + 1}: unit price variance ${variance} exceeds tolerance ${priceTol}%.`);
      }
    }
  }

  const status = exceptions.length ? "exception" : warnings.length ? "partial_match" : "matched";
  return {
    matched: exceptions.length === 0,
    status,
    exceptions,
    warnings,
  };
}

export function detectDuplicateSupplierInvoice(options: {
  existing: Array<Record<string, unknown>>;
  vendorId: string;
  supplierInvoiceNumber: string;
  excludeId?: string;
}) {
  const target = text(options.supplierInvoiceNumber).toLowerCase();
  return options.existing.some((row) => {
    if (options.excludeId && String(row.id) === options.excludeId) return false;
    if (text(row.vendorId) !== options.vendorId) return false;
    if (["cancelled", "rejected"].includes(text(row.status))) return false;
    return text(row.supplierInvoiceNumber).toLowerCase() === target;
  });
}
