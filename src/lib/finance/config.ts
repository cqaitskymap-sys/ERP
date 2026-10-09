/** Default three-way match quantity tolerance percent. */
export const DEFAULT_MATCH_QTY_TOLERANCE_PERCENT = 0;

/** Default three-way match price tolerance percent. */
export const DEFAULT_MATCH_PRICE_TOLERANCE_PERCENT = 0;

/** Default payment approval threshold (absolute amount). */
export const DEFAULT_PAYMENT_APPROVAL_THRESHOLD = 100000;

export const FINANCE_NUMBER_SERIES = {
  JE: { documentType: "JE", prefix: "JE" },
  SINV: { documentType: "SINV", prefix: "SINV" },
  CINV: { documentType: "CINV", prefix: "CINV" },
  PAY: { documentType: "PAY", prefix: "PAY" },
  PP: { documentType: "PP", prefix: "PP" },
  CRN: { documentType: "CRN", prefix: "CRN" },
  DRN: { documentType: "DRN", prefix: "DRN" },
  RCPT: { documentType: "RCPT", prefix: "RCPT" },
  BREC: { documentType: "BREC", prefix: "BREC" },
  EXP: { documentType: "EXP", prefix: "EXP" },
  FA: { documentType: "FA", prefix: "FA" },
  BUD: { documentType: "BUD", prefix: "BUD" },
} as const;

export const WORKFLOW_MODULES = {
  journalEntry: "finance_journal_entry",
  supplierInvoice: "finance_supplier_invoice",
  paymentProposal: "finance_payment_proposal",
  paymentExecution: "finance_payment_execution",
  customerInvoice: "finance_customer_invoice",
  creditNote: "finance_credit_note",
  bankReconciliation: "finance_bank_reconciliation",
  budget: "finance_budget",
  expenseClaim: "finance_expense_claim",
  periodClose: "finance_period_close",
} as const;
