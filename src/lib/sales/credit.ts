import { queryMasterDocuments, readMasterDocument } from "@/lib/masters/firestore";
import { SALES_COLLECTIONS } from "@/lib/sales/collections";
import {
  DEFAULT_CREDIT_UTILIZATION_THRESHOLD_PERCENT,
} from "@/lib/sales/config";
import { money } from "@/lib/sales/money";
import { text } from "@/lib/sales/helpers";

export interface CreditCheckResult {
  allowed: boolean;
  creditHold: boolean;
  creditLimit: number;
  outstandingBalance: number;
  overdueBalance: number;
  utilizationPercent: number;
  projectedOutstanding: number;
  reasons: string[];
  warnings: string[];
  source: "customer" | "receivable_snapshot" | "none";
}

export async function loadCustomerReceivableSnapshot(customerId: string, idToken: string) {
  const rows = await queryMasterDocuments(SALES_COLLECTIONS.receivables, idToken, {
    filters: [{ field: "customerId", value: customerId }],
    orderBy: [{ field: "asOfDate", direction: "DESCENDING" }],
    limit: 1,
  });
  return rows[0] || null;
}

export async function validateCustomerCredit(options: {
  customerId: string;
  orderValue: number;
  idToken: string;
  utilizationThresholdPercent?: number;
}): Promise<CreditCheckResult> {
  const customer = await readMasterDocument("customers", options.customerId, options.idToken);
  const snapshot = await loadCustomerReceivableSnapshot(options.customerId, options.idToken);
  const creditHold = Boolean(customer?.creditHold) || text(customer?.status) === "blocked";
  const creditLimit = money(snapshot?.creditLimit ?? customer?.creditLimit ?? 0);
  const outstandingBalance = money(snapshot?.outstandingBalance ?? customer?.outstandingBalance ?? 0);
  const overdueBalance = money(snapshot?.overdueBalance ?? customer?.overdueBalance ?? 0);
  const projectedOutstanding = money(outstandingBalance + options.orderValue);
  const utilizationPercent =
    creditLimit > 0 ? money((projectedOutstanding / creditLimit) * 100) : outstandingBalance > 0 ? 100 : 0;
  const threshold =
    options.utilizationThresholdPercent ?? DEFAULT_CREDIT_UTILIZATION_THRESHOLD_PERCENT;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!customer) {
    reasons.push("Customer was not found for credit validation.");
  }
  if (creditHold) {
    reasons.push("Customer is on credit hold or blocked.");
  }
  if (creditLimit > 0 && projectedOutstanding > creditLimit) {
    reasons.push(
      `Order would exceed credit limit (${creditLimit}). Projected outstanding: ${projectedOutstanding}.`
    );
  }
  if (overdueBalance > 0) {
    warnings.push(`Customer has overdue balance of ${overdueBalance}.`);
  }
  if (utilizationPercent >= threshold) {
    warnings.push(`Credit utilization would reach ${utilizationPercent}% (threshold ${threshold}%).`);
  }
  if (!snapshot && creditLimit <= 0) {
    warnings.push(
      "No finance receivable snapshot or credit limit is configured. Credit check is informational only."
    );
  }

  return {
    allowed: reasons.length === 0,
    creditHold,
    creditLimit,
    outstandingBalance,
    overdueBalance,
    utilizationPercent,
    projectedOutstanding,
    reasons,
    warnings,
    source: snapshot ? "receivable_snapshot" : customer ? "customer" : "none",
  };
}

export function agingBuckets(overdueBalance: number, outstandingBalance: number) {
  // Without invoice due-date detail from Finance, expose a scoped summary only.
  const current = money(Math.max(0, outstandingBalance - overdueBalance));
  return {
    current,
    overdue: money(overdueBalance),
    total: money(outstandingBalance),
    note: "Detailed aging by bucket requires the Finance AR module or imported invoice due dates.",
  };
}
