import { queryMasterDocuments, readMasterDocument } from "@/lib/masters/firestore";
import { FINANCE_COLLECTIONS } from "@/lib/finance/collections";
import { money, percentOf, addMoney } from "@/lib/finance/money";
import { text } from "@/lib/finance/helpers";

export interface TaxBreakdownLine {
  taxCodeId: string;
  taxCode: string;
  taxType: string;
  ratePercent: number;
  taxableAmount: number;
  taxAmount: number;
}

export function isTaxEffective(rule: Record<string, unknown>, onDate: string) {
  const from = text(rule.effectiveFrom);
  const to = text(rule.effectiveTo);
  if (from && onDate < from) return false;
  if (to && onDate > to) return false;
  return true;
}

export async function loadActiveTaxCode(taxCodeId: string, idToken: string, onDate: string) {
  const financeTax = await readMasterDocument(FINANCE_COLLECTIONS.taxCodes, taxCodeId, idToken);
  if (financeTax && text(financeTax.status) === "active" && isTaxEffective(financeTax, onDate)) {
    return financeTax;
  }
  const masterTax = await readMasterDocument("taxes", taxCodeId, idToken);
  if (masterTax && (!text(masterTax.status) || text(masterTax.status) === "active")) {
    return {
      ...masterTax,
      taxCode: masterTax.taxCode || masterTax.id,
      ratePercent: masterTax.percentage ?? masterTax.ratePercent,
      taxType: masterTax.taxType || "other",
    };
  }
  return null;
}

export function calculateTaxBreakdown(options: {
  taxableAmount: number;
  ratePercent: number;
  taxCodeId: string;
  taxCode: string;
  taxType: string;
  inclusive?: boolean;
}): TaxBreakdownLine {
  const taxable = money(options.taxableAmount);
  const rate = money(options.ratePercent);
  if (options.inclusive && rate > 0) {
    const taxAmount = money(taxable - taxable / (1 + rate / 100));
    return {
      taxCodeId: options.taxCodeId,
      taxCode: options.taxCode,
      taxType: options.taxType,
      ratePercent: rate,
      taxableAmount: money(taxable - taxAmount),
      taxAmount,
    };
  }
  return {
    taxCodeId: options.taxCodeId,
    taxCode: options.taxCode,
    taxType: options.taxType,
    ratePercent: rate,
    taxableAmount: taxable,
    taxAmount: percentOf(taxable, rate),
  };
}

/** India GST split helper based on configured place-of-supply flag. */
export function splitGstComponents(options: {
  taxableAmount: number;
  gstRatePercent: number;
  sameState: boolean;
}) {
  const taxable = money(options.taxableAmount);
  const totalTax = percentOf(taxable, options.gstRatePercent);
  if (options.sameState) {
    const half = money(totalTax / 2);
    return {
      cgst: half,
      sgst: money(totalTax - half),
      igst: 0,
      totalTax,
    };
  }
  return { cgst: 0, sgst: 0, igst: totalTax, totalTax };
}

export async function listActiveTaxCodes(idToken: string) {
  const rows = await queryMasterDocuments(FINANCE_COLLECTIONS.taxCodes, idToken, {
    filters: [{ field: "status", value: "active" }],
    limit: 200,
  });
  return rows;
}

export function sumTaxBreakdown(lines: TaxBreakdownLine[]) {
  return lines.reduce((sum, line) => addMoney(sum, line.taxAmount), 0);
}
