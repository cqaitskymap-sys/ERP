export const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;
export const NORMAL_BALANCES = ["debit", "credit"] as const;
export const ACCOUNT_STATUSES = ["draft", "active", "inactive"] as const;

export const ACCOUNT_CATEGORIES = [
  "cash",
  "bank",
  "inventory",
  "fixed_assets",
  "accounts_payable",
  "accounts_receivable",
  "revenue",
  "manufacturing_expense",
  "administrative_expense",
  "tax",
  "equity",
  "other",
] as const;

export const JOURNAL_STATUSES = [
  "draft",
  "submitted",
  "pending_approval",
  "approved",
  "posted",
  "reversed",
  "rejected",
  "cancelled",
] as const;

export const SUPPLIER_INVOICE_STATUSES = [
  "draft",
  "submitted",
  "matching",
  "exception_review",
  "pending_approval",
  "approved",
  "posted",
  "partially_paid",
  "paid",
  "on_hold",
  "rejected",
  "cancelled",
] as const;

export const MATCH_STATUSES = [
  "not_started",
  "matched",
  "partial_match",
  "exception",
  "waived",
] as const;

export const PAYMENT_STATUSES = [
  "draft",
  "proposed",
  "pending_approval",
  "approved",
  "submitted_manual",
  "awaiting_confirmation",
  "confirmed",
  "posted",
  "rejected",
  "cancelled",
] as const;

export const CUSTOMER_INVOICE_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "posted",
  "partially_paid",
  "paid",
  "disputed",
  "cancelled",
] as const;

export const CREDIT_NOTE_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "posted",
  "applied",
  "cancelled",
] as const;

export const BANK_RECON_STATUSES = [
  "imported",
  "validated",
  "matching",
  "exception_review",
  "pending_approval",
  "completed",
  "cancelled",
] as const;

export const PERIOD_STATUSES = ["open", "closing", "closed", "reopened"] as const;

export const BUDGET_STATUSES = ["draft", "pending_approval", "approved", "active", "superseded", "cancelled"] as const;

export const EXPENSE_STATUSES = [
  "draft",
  "submitted",
  "pending_approval",
  "approved",
  "rejected",
  "reimbursed",
  "posted",
  "cancelled",
] as const;

export const ASSET_STATUSES = ["draft", "active", "fully_depreciated", "disposed", "cancelled"] as const;

export const FINANCE_REPORT_TYPES = [
  "general_ledger",
  "journal_register",
  "trial_balance",
  "profit_and_loss",
  "balance_sheet",
  "cash_flow",
  "ap_aging",
  "ar_aging",
  "supplier_statement",
  "customer_statement",
  "purchase_invoice_register",
  "sales_invoice_register",
  "payment_register",
  "bank_reconciliation",
  "tax_summary",
  "cost_center",
  "budget_vs_actual",
  "fixed_asset_register",
  "period_closing",
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type JournalStatus = (typeof JOURNAL_STATUSES)[number];
export type SupplierInvoiceStatus = (typeof SUPPLIER_INVOICE_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type CustomerInvoiceStatus = (typeof CUSTOMER_INVOICE_STATUSES)[number];
export type FinanceReportType = (typeof FINANCE_REPORT_TYPES)[number];

export interface MoneyCents {
  cents: number;
  amount: number;
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;
}
