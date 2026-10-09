import {
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  ASSET_STATUSES,
  BANK_RECON_STATUSES,
  BUDGET_STATUSES,
  CREDIT_NOTE_STATUSES,
  CUSTOMER_INVOICE_STATUSES,
  EXPENSE_STATUSES,
  FINANCE_REPORT_TYPES,
  JOURNAL_STATUSES,
  MATCH_STATUSES,
  PAYMENT_STATUSES,
  PERIOD_STATUSES,
  SUPPLIER_INVOICE_STATUSES,
} from "@/types/finance";

function options(values: readonly string[], labels: Record<string, string> = {}) {
  return values.map((value) => ({
    value,
    label: labels[value] || value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
}

export const accountTypeOptions = options(ACCOUNT_TYPES);
export const accountStatusOptions = options(ACCOUNT_STATUSES);
export const journalStatusOptions = options(JOURNAL_STATUSES);
export const supplierInvoiceStatusOptions = options(SUPPLIER_INVOICE_STATUSES);
export const matchStatusOptions = options(MATCH_STATUSES);
export const paymentStatusOptions = options(PAYMENT_STATUSES);
export const customerInvoiceStatusOptions = options(CUSTOMER_INVOICE_STATUSES);
export const creditNoteStatusOptions = options(CREDIT_NOTE_STATUSES);
export const bankReconStatusOptions = options(BANK_RECON_STATUSES);
export const periodStatusOptions = options(PERIOD_STATUSES);
export const budgetStatusOptions = options(BUDGET_STATUSES);
export const expenseStatusOptions = options(EXPENSE_STATUSES);
export const assetStatusOptions = options(ASSET_STATUSES);
export const reportTypeOptions = options(FINANCE_REPORT_TYPES);

export function labelFor(optionsList: Array<{ label: string; value: string }>, value: string) {
  return optionsList.find((row) => row.value === value)?.label || value || "—";
}

export function workflowTone(status: string): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  if (
    [
      "approved",
      "posted",
      "paid",
      "active",
      "completed",
      "confirmed",
      "matched",
      "applied",
      "reimbursed",
      "closed",
    ].includes(status)
  ) {
    return "success";
  }
  if (
    [
      "pending_approval",
      "submitted",
      "matching",
      "exception_review",
      "proposed",
      "awaiting_confirmation",
      "closing",
      "partially_paid",
      "partial_match",
    ].includes(status)
  ) {
    return "warning";
  }
  if (["on_hold"].includes(status)) return "hold";
  if (["rejected", "cancelled", "reversed", "disputed", "exception"].includes(status)) return "critical";
  if (["submitted_manual", "imported", "validated", "draft", "open", "reopened"].includes(status)) return "info";
  return "neutral";
}

export const ALL_STATUS_OPTIONS = [
  ...accountStatusOptions,
  ...journalStatusOptions,
  ...supplierInvoiceStatusOptions,
  ...paymentStatusOptions,
  ...customerInvoiceStatusOptions,
  ...creditNoteStatusOptions,
  ...bankReconStatusOptions,
  ...periodStatusOptions,
  ...budgetStatusOptions,
  ...expenseStatusOptions,
  ...assetStatusOptions,
];
