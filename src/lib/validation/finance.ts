import { z } from "zod";
import {
  ACCOUNT_CATEGORIES,
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  ASSET_STATUSES,
  BANK_RECON_STATUSES,
  BUDGET_STATUSES,
  CREDIT_NOTE_STATUSES,
  EXPENSE_STATUSES,
  JOURNAL_STATUSES,
  NORMAL_BALANCES,
  PERIOD_STATUSES,
} from "@/types/finance";

const optionalText = z.string().trim().optional().or(z.literal(""));
const moneyField = z.coerce.number().min(0).default(0);
const amountField = z.coerce.number();

export const chartOfAccountSchema = z.object({
  accountCode: z.string().trim().min(1, "Account code is required."),
  accountName: z.string().trim().min(2, "Account name is required."),
  accountType: z.enum(ACCOUNT_TYPES),
  accountCategory: z.enum(ACCOUNT_CATEGORIES).default("other"),
  parentAccountId: optionalText,
  normalBalance: z.enum(NORMAL_BALANCES),
  postingAllowed: z.boolean().default(true),
  openingBalance: moneyField,
  effectiveDate: z.string().trim().min(1, "Effective date is required."),
  status: z.enum(ACCOUNT_STATUSES).default("draft"),
  reportingCategory: optionalText,
  taxApplicable: z.boolean().default(false),
  remarks: optionalText,
  idempotencyKey: optionalText,
});

const journalLineSchema = z.object({
  accountId: z.string().trim().min(1, "Account is required."),
  debit: moneyField,
  credit: moneyField,
  costCenterId: optionalText,
  narration: optionalText,
});

export const journalEntrySchema = z.object({
  postingDate: z.string().trim().min(1, "Posting date is required."),
  transactionDate: z.string().trim().min(1, "Transaction date is required."),
  periodId: optionalText,
  sourceModule: optionalText,
  sourceDocumentType: optionalText,
  sourceDocumentId: optionalText,
  currency: z.string().trim().min(1).default("INR"),
  exchangeRate: z.coerce.number().positive().default(1),
  narration: z.string().trim().min(2, "Narration is required."),
  status: z.enum(JOURNAL_STATUSES).optional(),
  idempotencyKey: optionalText,
  lines: z.array(journalLineSchema).min(2, "At least two journal lines are required."),
});

const invoiceLineSchema = z.object({
  description: optionalText,
  materialId: optionalText,
  productId: optionalText,
  quantity: z.coerce.number().positive(),
  unitPrice: moneyField,
  discount: moneyField,
  tax: moneyField,
  taxCodeId: optionalText,
  freight: moneyField,
  otherCharges: moneyField,
  poLineId: optionalText,
  receiptLineId: optionalText,
});

export const supplierInvoiceSchema = z.object({
  vendorId: z.string().trim().min(1, "Supplier is required."),
  supplierInvoiceNumber: z.string().trim().min(1, "Supplier invoice number is required."),
  purchaseOrderId: optionalText,
  goodsReceiptIds: z.array(z.string()).default([]),
  invoiceDate: z.string().trim().min(1, "Invoice date is required."),
  dueDate: z.string().trim().min(1, "Due date is required."),
  currency: z.string().trim().min(1).default("INR"),
  exchangeRate: z.coerce.number().positive().default(1),
  isServiceInvoice: z.boolean().default(false),
  attachmentPath: optionalText,
  remarks: optionalText,
  idempotencyKey: optionalText,
  items: z.array(invoiceLineSchema).min(1, "At least one line is required."),
});

export const paymentProposalSchema = z.object({
  vendorId: z.string().trim().min(1, "Supplier is required."),
  invoiceIds: z.array(z.string()).min(1, "Select at least one invoice."),
  proposalDate: z.string().trim().min(1),
  scheduledPaymentDate: optionalText,
  currency: z.string().trim().min(1).default("INR"),
  bankAccountId: optionalText,
  priority: z.enum(["normal", "high", "urgent"]).default("normal"),
  remarks: optionalText,
  idempotencyKey: optionalText,
});

export const paymentConfirmationSchema = z.object({
  paymentReference: z.string().trim().min(1, "Payment reference is required."),
  confirmedAmount: z.coerce.number().positive(),
  confirmationDate: z.string().trim().min(1),
  confirmationEvidence: optionalText,
  remarks: optionalText,
});

export const customerInvoiceSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required."),
  salesOrderId: optionalText,
  shipmentId: optionalText,
  invoiceDate: z.string().trim().min(1),
  dueDate: z.string().trim().min(1),
  currency: z.string().trim().min(1).default("INR"),
  remarks: optionalText,
  idempotencyKey: optionalText,
  items: z.array(invoiceLineSchema).min(1),
});

export const customerReceiptSchema = z.object({
  customerId: z.string().trim().min(1),
  receiptDate: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().min(1).default("INR"),
  bankAccountId: optionalText,
  paymentReference: optionalText,
  confirmationEvidence: optionalText,
  invoiceAllocations: z
    .array(
      z.object({
        customerInvoiceId: z.string().trim().min(1),
        amount: z.coerce.number().positive(),
      })
    )
    .default([]),
  remarks: optionalText,
  idempotencyKey: optionalText,
});

export const creditNoteSchema = z.object({
  partyType: z.enum(["customer", "supplier"]),
  partyId: z.string().trim().min(1),
  originalInvoiceId: z.string().trim().min(1),
  reason: z.string().trim().min(2),
  amount: z.coerce.number().positive(),
  taxAmount: moneyField,
  currency: z.string().trim().min(1).default("INR"),
  salesReturnId: optionalText,
  supportingDocumentPath: optionalText,
  status: z.enum(CREDIT_NOTE_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const debitNoteSchema = z.object({
  vendorId: z.string().trim().min(1),
  originalInvoiceId: z.string().trim().min(1),
  reason: z.string().trim().min(2),
  amount: z.coerce.number().positive(),
  taxAmount: moneyField,
  currency: z.string().trim().min(1).default("INR"),
  idempotencyKey: optionalText,
});

export const bankAccountSchema = z.object({
  accountName: z.string().trim().min(2),
  bankName: z.string().trim().min(2),
  branch: optionalText,
  accountReference: z.string().trim().min(4, "Account reference is required."),
  currency: z.string().trim().min(1).default("INR"),
  ledgerAccountId: z.string().trim().min(1, "Ledger account is required."),
  openingBalance: moneyField,
  reconciliationFrequency: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
  status: z.enum(["active", "inactive"]).default("active"),
  idempotencyKey: optionalText,
});

export const bankStatementImportSchema = z.object({
  bankAccountId: z.string().trim().min(1),
  statementDate: z.string().trim().min(1),
  openingBalance: amountField,
  closingBalance: amountField,
  transactions: z
    .array(
      z.object({
        transactionDate: z.string().trim().min(1),
        description: z.string().trim().min(1),
        reference: optionalText,
        debit: moneyField,
        credit: moneyField,
      })
    )
    .min(1),
  idempotencyKey: optionalText,
});

export const taxCodeSchema = z.object({
  taxCode: z.string().trim().min(1),
  taxName: z.string().trim().min(2),
  taxType: z.enum(["gst", "cgst", "sgst", "igst", "tds", "other"]).default("gst"),
  ratePercent: z.coerce.number().min(0),
  effectiveFrom: z.string().trim().min(1),
  effectiveTo: optionalText,
  inclusive: z.boolean().default(false),
  applicableTransactionTypes: optionalText,
  ledgerAccountId: optionalText,
  status: z.enum(["active", "inactive"]).default("active"),
  idempotencyKey: optionalText,
});

export const costCenterSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(2),
  departmentId: optionalText,
  status: z.enum(["active", "inactive"]).default("active"),
  remarks: optionalText,
  idempotencyKey: optionalText,
});

export const budgetSchema = z.object({
  name: z.string().trim().min(2),
  financialYearId: z.string().trim().min(1),
  costCenterId: optionalText,
  departmentId: optionalText,
  currency: z.string().trim().min(1).default("INR"),
  annualAmount: moneyField,
  monthlyAmounts: z.array(z.coerce.number().min(0)).default([]),
  status: z.enum(BUDGET_STATUSES).optional(),
  remarks: optionalText,
  idempotencyKey: optionalText,
});

export const fixedAssetSchema = z.object({
  description: z.string().trim().min(2),
  category: z.string().trim().min(1),
  acquisitionDate: z.string().trim().min(1),
  acquisitionCost: z.coerce.number().positive(),
  location: optionalText,
  departmentId: optionalText,
  usefulLifeMonths: z.coerce.number().positive(),
  depreciationMethod: z.enum(["straight_line", "reducing_balance"]).default("straight_line"),
  residualValue: moneyField,
  status: z.enum(ASSET_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const expenseClaimSchema = z.object({
  employeeId: z.string().trim().min(1),
  departmentId: optionalText,
  costCenterId: optionalText,
  expenseCategory: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().min(1).default("INR"),
  expenseDate: z.string().trim().min(1),
  receiptPath: optionalText,
  remarks: optionalText,
  status: z.enum(EXPENSE_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const financePeriodSchema = z.object({
  financialYearId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().min(1),
  status: z.enum(PERIOD_STATUSES).default("open"),
  idempotencyKey: optionalText,
});

export const financeSettingsSchema = z.object({
  matchQtyTolerancePercent: z.coerce.number().min(0).default(0),
  matchPriceTolerancePercent: z.coerce.number().min(0).default(0),
  paymentApprovalThreshold: z.coerce.number().min(0).default(100000),
  defaultCurrency: z.string().trim().min(1).default("INR"),
  requireEvidenceForPaymentConfirmation: z.boolean().default(true),
  defaultApAccountId: optionalText,
  defaultArAccountId: optionalText,
  defaultExpenseAccountId: optionalText,
  defaultRevenueAccountId: optionalText,
  defaultBankClearingAccountId: optionalText,
  defaultTaxPayableAccountId: optionalText,
});

export const bankReconSchema = z.object({
  bankAccountId: z.string().trim().min(1),
  statementId: z.string().trim().min(1),
  status: z.enum(BANK_RECON_STATUSES).optional(),
  remarks: optionalText,
  idempotencyKey: optionalText,
});
