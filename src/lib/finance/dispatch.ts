import { FINANCE_COLLECTIONS } from "@/lib/finance/collections";
import { isFinanceResource, type FinanceResource } from "@/lib/finance/http";
import { canSeeFinanceSensitive, listByField, maskBankReference } from "@/lib/finance/helpers";
import { loadApprovals } from "@/lib/finance/approvals";
import {
  approveJournalEntry,
  createChartAccount,
  createJournalEntry,
  createSupplierInvoice,
  deactivateAccount,
  matchSupplierInvoice,
  approveSupplierInvoice,
  postJournalEntry,
  postSupplierInvoice,
  reverseJournalEntry,
  submitJournalEntry,
} from "@/lib/finance/server";
import {
  advanceBankReconciliation,
  allocateCustomerReceipt,
  approveCustomerInvoice,
  approvePaymentProposal,
  closeFinancialPeriod,
  createBankAccount,
  createBudget,
  createCostCenter,
  createCreditNote,
  createCustomerInvoice,
  createDebitNote,
  createExpenseClaim,
  createFinancePeriod,
  createFixedAsset,
  createPaymentProposal,
  createTaxCode,
  importBankStatement,
  postConfirmedPayment,
  postCustomerInvoice,
  recordPaymentConfirmation,
  reopenFinancialPeriod,
  saveFinanceSettings,
  submitPaymentManual,
} from "@/lib/finance/server-ops";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";

const COLLECTION_MAP: Record<FinanceResource, string> = {
  accounts: FINANCE_COLLECTIONS.accounts,
  journals: FINANCE_COLLECTIONS.journals,
  supplierInvoices: FINANCE_COLLECTIONS.supplierInvoices,
  paymentProposals: FINANCE_COLLECTIONS.paymentProposals,
  payments: FINANCE_COLLECTIONS.payments,
  customerInvoices: FINANCE_COLLECTIONS.customerInvoices,
  customerReceipts: FINANCE_COLLECTIONS.customerReceipts,
  creditNotes: FINANCE_COLLECTIONS.creditNotes,
  debitNotes: FINANCE_COLLECTIONS.debitNotes,
  bankAccounts: FINANCE_COLLECTIONS.bankAccounts,
  bankStatements: FINANCE_COLLECTIONS.bankStatements,
  bankReconciliations: FINANCE_COLLECTIONS.bankReconciliations,
  taxCodes: FINANCE_COLLECTIONS.taxCodes,
  costCenters: FINANCE_COLLECTIONS.costCenters,
  budgets: FINANCE_COLLECTIONS.budgets,
  fixedAssets: FINANCE_COLLECTIONS.fixedAssets,
  expenseClaims: FINANCE_COLLECTIONS.expenseClaims,
  periods: FINANCE_COLLECTIONS.periods,
  settings: FINANCE_COLLECTIONS.settings,
};

export async function createFinanceRecord(
  resource: FinanceResource,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  if (resource === "accounts") return createChartAccount({ payload, session, idToken });
  if (resource === "journals") return createJournalEntry({ payload, session, idToken });
  if (resource === "supplierInvoices") return createSupplierInvoice({ payload, session, idToken });
  if (resource === "paymentProposals") return createPaymentProposal({ payload, session, idToken });
  if (resource === "customerInvoices") return createCustomerInvoice({ payload, session, idToken });
  if (resource === "customerReceipts") return allocateCustomerReceipt({ payload, session, idToken });
  if (resource === "creditNotes") return createCreditNote({ payload, session, idToken });
  if (resource === "debitNotes") return createDebitNote({ payload, session, idToken });
  if (resource === "bankAccounts") return createBankAccount({ payload, session, idToken });
  if (resource === "bankStatements") return importBankStatement({ payload, session, idToken });
  if (resource === "taxCodes") return createTaxCode({ payload, session, idToken });
  if (resource === "costCenters") return createCostCenter({ payload, session, idToken });
  if (resource === "budgets") return createBudget({ payload, session, idToken });
  if (resource === "fixedAssets") return createFixedAsset({ payload, session, idToken });
  if (resource === "expenseClaims") return createExpenseClaim({ payload, session, idToken });
  if (resource === "periods") return createFinancePeriod({ payload, session, idToken });
  if (resource === "settings") return saveFinanceSettings({ payload, session, idToken });
  throw createNamedError("ValidationError", "This finance resource cannot be created directly.");
}

export async function loadFinanceDetail(
  resource: FinanceResource,
  id: string,
  idToken: string,
  session: SessionPayload
) {
  const record = await readMasterDocument(COLLECTION_MAP[resource], id, idToken);
  if (!record) return null;
  const extra: Record<string, unknown> = {};
  if (resource === "journals") {
    extra.lines = await listByField(FINANCE_COLLECTIONS.journalLines, "journalId", id, idToken);
    extra.approvals = await loadApprovals(id, idToken);
  }
  if (resource === "supplierInvoices") {
    extra.items = await listByField(FINANCE_COLLECTIONS.supplierInvoiceLines, "supplierInvoiceId", id, idToken);
    extra.approvals = await loadApprovals(id, idToken);
  }
  if (resource === "customerInvoices") {
    extra.items = await listByField(FINANCE_COLLECTIONS.customerInvoiceLines, "customerInvoiceId", id, idToken);
    extra.approvals = await loadApprovals(id, idToken);
  }
  if (resource === "paymentProposals" || resource === "payments" || resource === "creditNotes" || resource === "budgets" || resource === "expenseClaims") {
    extra.approvals = await loadApprovals(id, idToken);
  }
  if (resource === "bankStatements") {
    extra.transactions = await listByField(FINANCE_COLLECTIONS.bankTransactions, "statementId", id, idToken);
  }
  let visible = record;
  if (resource === "bankAccounts" && !canSeeFinanceSensitive(session)) {
    visible = {
      ...record,
      accountReference: maskBankReference(record.accountReferenceMasked || record.accountReference),
    };
  }
  return { record: visible, extra };
}

export async function runFinanceAction(
  resource: FinanceResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  const comment = String(payload.comment || payload.reason || "");
  if (resource === "accounts" && action === "deactivate") {
    return deactivateAccount({ id, session, idToken, reason: comment });
  }
  if (resource === "journals") {
    if (action === "submit") return submitJournalEntry({ id, session, idToken });
    if (["approve", "reject", "return"].includes(action)) {
      return approveJournalEntry({ id, action: action as "approve" | "reject" | "return", comment, session, idToken });
    }
    if (action === "post") return postJournalEntry({ id, session, idToken, reason: comment });
    if (action === "reverse") return reverseJournalEntry({ id, reason: comment || "Reversal", session, idToken });
  }
  if (resource === "supplierInvoices") {
    if (action === "match") return matchSupplierInvoice({ id, session, idToken });
    if (["submit", "approve", "reject", "hold"].includes(action)) {
      return approveSupplierInvoice({
        id,
        action: action as "submit" | "approve" | "reject" | "hold",
        comment,
        session,
        idToken,
      });
    }
    if (action === "post") return postSupplierInvoice({ id, session, idToken });
  }
  if (resource === "paymentProposals" && ["approve", "reject"].includes(action)) {
    return approvePaymentProposal({ id, action: action as "approve" | "reject", comment, session, idToken });
  }
  if (resource === "payments") {
    if (action === "submit_manual") return submitPaymentManual({ id, session, idToken, reason: comment });
    if (action === "confirm") return recordPaymentConfirmation({ id, payload, session, idToken });
    if (action === "post") return postConfirmedPayment({ id, session, idToken });
  }
  if (resource === "customerInvoices") {
    if (["submit", "approve", "reject"].includes(action)) {
      return approveCustomerInvoice({
        id,
        action: action as "submit" | "approve" | "reject",
        comment,
        session,
        idToken,
      });
    }
    if (action === "post") return postCustomerInvoice({ id, session, idToken });
  }
  if (resource === "bankReconciliations" && action === "transition" && payload.toStatus) {
    return advanceBankReconciliation({
      id,
      toStatus: String(payload.toStatus),
      session,
      idToken,
      reason: comment,
    });
  }
  if (resource === "periods") {
    if (action === "close") return closeFinancialPeriod({ id, session, idToken, reason: comment });
    if (action === "reopen") return reopenFinancialPeriod({ id, reason: comment || "Reopen", session, idToken });
  }
  if (!isFinanceResource(resource)) throw createNamedError("ValidationError", "Unknown finance resource.");
  throw createNamedError("ValidationError", `Unsupported action "${action}" for ${resource}.`);
}
