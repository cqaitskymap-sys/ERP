import { searchIndex } from "@/lib/inventory/keys";
import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import { PROCUREMENT_COLLECTIONS } from "@/lib/procurement/collections";
import { SALES_COLLECTIONS } from "@/lib/sales/collections";
import { queryMasterDocuments, readMasterDocument, type AtomicWrite } from "@/lib/masters/firestore";
import {
  applyApprovalAction,
  createFinanceApprovalWrites,
  FINANCE_APPROVALS_COLLECTION,
  loadApprovals,
  loadWorkflowConfig,
  type FinanceWorkflowModule,
} from "@/lib/finance/approvals";
import { FINANCE_COLLECTIONS } from "@/lib/finance/collections";
import {
  DEFAULT_MATCH_PRICE_TOLERANCE_PERCENT,
  DEFAULT_MATCH_QTY_TOLERANCE_PERCENT,
  WORKFLOW_MODULES,
} from "@/lib/finance/config";
import {
  actorStamp,
  auditFinance,
  canSeeFinanceSensitive,
  commitWrites,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueFinanceNumber,
  listByField,
  maskBankReference,
  notifyFinance,
  parseOrFail,
  requireRecord,
  reuseIdempotent,
  text,
  workflowFail,
  writeOf,
} from "@/lib/finance/helpers";
import {
  calculateAgingBuckets,
  calculateTrialBalance,
  generateBalanceSheet,
  generateProfitAndLoss,
  validateJournalEntry,
} from "@/lib/finance/ledger";
import { detectDuplicateSupplierInvoice, matchSupplierInvoiceLines } from "@/lib/finance/matching";
import { addMoney, calculateDocumentTotals, calculateLineTotal, money, subtractMoney } from "@/lib/finance/money";
import { periodClosingChecklist, validateAccountingPeriod } from "@/lib/finance/periods";
import { calculateTaxBreakdown } from "@/lib/finance/tax";
import {
  BANK_RECON_TRANSITIONS,
  CREDIT_NOTE_TRANSITIONS,
  CUSTOMER_INVOICE_TRANSITIONS,
  JOURNAL_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  PERIOD_TRANSITIONS,
  SUPPLIER_INVOICE_TRANSITIONS,
  canTransition,
} from "@/lib/finance/status";
import {
  bankAccountSchema,
  bankStatementImportSchema,
  budgetSchema,
  chartOfAccountSchema,
  creditNoteSchema,
  customerInvoiceSchema,
  customerReceiptSchema,
  debitNoteSchema,
  expenseClaimSchema,
  financePeriodSchema,
  financeSettingsSchema,
  fixedAssetSchema,
  journalEntrySchema,
  paymentConfirmationSchema,
  paymentProposalSchema,
  supplierInvoiceSchema,
  taxCodeSchema,
  costCenterSchema,
} from "@/lib/validation/finance";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";

function assertTransition(map: Record<string, string[]>, current: string, next: string, action: string) {
  if (!canTransition(map, current, next)) workflowFail(current, action);
}

async function loadSettings(idToken: string) {
  const rows = await queryMasterDocuments(FINANCE_COLLECTIONS.settings, idToken, { limit: 1 });
  const row = rows[0];
  return {
    matchQtyTolerancePercent: money(row?.matchQtyTolerancePercent ?? DEFAULT_MATCH_QTY_TOLERANCE_PERCENT),
    matchPriceTolerancePercent: money(row?.matchPriceTolerancePercent ?? DEFAULT_MATCH_PRICE_TOLERANCE_PERCENT),
    paymentApprovalThreshold: money(row?.paymentApprovalThreshold ?? 100000),
    defaultCurrency: text(row?.defaultCurrency) || "INR",
    requireEvidenceForPaymentConfirmation: row?.requireEvidenceForPaymentConfirmation !== false,
    defaultApAccountId: text(row?.defaultApAccountId),
    defaultArAccountId: text(row?.defaultArAccountId),
    defaultExpenseAccountId: text(row?.defaultExpenseAccountId),
    defaultRevenueAccountId: text(row?.defaultRevenueAccountId),
    defaultBankClearingAccountId: text(row?.defaultBankClearingAccountId),
    defaultTaxPayableAccountId: text(row?.defaultTaxPayableAccountId),
  };
}

async function startApprovals(options: {
  module: FinanceWorkflowModule;
  documentType: string;
  documentId: string;
  documentNumber: string;
  requestedBy: string;
  session: SessionPayload;
  idToken: string;
}) {
  const workflow = await loadWorkflowConfig(options.module, options.idToken);
  return {
    workflow,
    writes: createFinanceApprovalWrites({
      documentType: options.documentType,
      documentId: options.documentId,
      documentNumber: options.documentNumber,
      requestedBy: options.requestedBy,
      steps: workflow.steps,
      session: options.session,
    }),
  };
}

async function handleApproval(options: {
  documentId: string;
  action: "approve" | "reject" | "return";
  comment?: string;
  session: SessionPayload;
  idToken: string;
  module: FinanceWorkflowModule;
}) {
  const approvals = await loadApprovals(options.documentId, options.idToken);
  const workflow = await loadWorkflowConfig(options.module, options.idToken);
  return applyApprovalAction({
    approvals,
    action: options.action,
    comment: options.comment,
    session: options.session,
    allowSelfApproval: workflow.allowSelfApproval,
  });
}

async function assertAccountPostable(accountId: string, idToken: string) {
  const account = await requireRecord(FINANCE_COLLECTIONS.accounts, accountId, idToken, "Account");
  if (text(account.status) !== "active") fail(`Account ${text(account.accountCode)} is not active.`);
  if (account.postingAllowed === false) fail(`Account ${text(account.accountCode)} does not allow posting.`);
  return account;
}

/* -------------------------------------------------------------------------- */
/* Chart of accounts                                                          */
/* -------------------------------------------------------------------------- */

export async function createChartAccount(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeAccounts:create");
  const data = parseOrFail(chartOfAccountSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  const duplicates = await queryMasterDocuments(FINANCE_COLLECTIONS.accounts, options.idToken, {
    filters: [{ field: "accountCode", value: data.accountCode }],
    limit: 1,
  });
  if (duplicates.length) fail("An account with this code already exists.");
  if (data.parentAccountId) {
    await requireRecord(FINANCE_COLLECTIONS.accounts, data.parentAccountId, options.idToken, "Parent account");
  }
  const id = crypto.randomUUID();
  const record = {
    accountId: id,
    ...data,
    searchIndex: searchIndex(data.accountCode, data.accountName),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(FINANCE_COLLECTIONS.accounts, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditFinance(options.idToken, options.session, {
    action: "ACCOUNT_CREATED",
    resource: FINANCE_COLLECTIONS.accounts,
    resourceId: id,
    description: `Created account ${data.accountCode}.`,
  });
  return { id, record };
}

export async function deactivateAccount(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  ensurePermission(options.session, "financeAccounts:update");
  const current = await requireRecord(FINANCE_COLLECTIONS.accounts, options.id, options.idToken, "Account");
  const postings = await queryMasterDocuments(FINANCE_COLLECTIONS.journalLines, options.idToken, {
    filters: [{ field: "accountId", value: options.id }],
    limit: 1,
  });
  if (postings.length && text(current.status) === "active") {
    // Allow deactivation but never deletion of referenced accounts.
  }
  const next = {
    ...current,
    status: "inactive",
    deactivatedBy: options.session.uid,
    deactivatedAt: new Date().toISOString(),
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(FINANCE_COLLECTIONS.accounts, options.id, next)], options.idToken);
  await auditFinance(options.idToken, options.session, {
    action: "ACCOUNT_DEACTIVATED",
    resource: FINANCE_COLLECTIONS.accounts,
    resourceId: options.id,
    description: `Deactivated account ${text(current.accountCode)}.`,
    reason: options.reason,
  });
  return { id: options.id, record: next };
}

/* -------------------------------------------------------------------------- */
/* Journals / GL                                                              */
/* -------------------------------------------------------------------------- */

export async function createJournalEntry(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeJournal:create");
  const data = parseOrFail(journalEntrySchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) {
    return reused as { id: string; record: Record<string, unknown>; lines: Array<Record<string, unknown>> };
  }
  const totals = validateJournalEntry(data.lines);
  for (const line of data.lines) await assertAccountPostable(line.accountId, options.idToken);
  await validateAccountingPeriod({
    periodId: data.periodId,
    postingDate: data.postingDate,
    idToken: options.idToken,
  });
  if (data.sourceDocumentId && data.sourceDocumentType) {
    const existing = await queryMasterDocuments(FINANCE_COLLECTIONS.journals, options.idToken, {
      filters: [
        { field: "sourceDocumentId", value: data.sourceDocumentId },
        { field: "sourceDocumentType", value: data.sourceDocumentType },
      ],
      limit: 5,
    });
    if (existing.some((row) => ["posted", "approved", "pending_approval", "submitted"].includes(text(row.status)))) {
      fail("A journal already exists for this source document. Duplicate posting is not allowed.");
    }
  }
  const id = crypto.randomUUID();
  const numbered = await issueFinanceNumber("JE", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const lines = data.lines.map((line, index) => {
    const lineId = crypto.randomUUID();
    const record = {
      lineId,
      journalId: id,
      lineNumber: index + 1,
      ...line,
      debit: money(line.debit),
      credit: money(line.credit),
      ...actorStamp(options.session),
    };
    writes.push(writeOf(FINANCE_COLLECTIONS.journalLines, lineId, record, { exists: false }));
    return record;
  });
  const record = {
    journalId: id,
    journalNumber: numbered.documentNumber,
    postingDate: data.postingDate,
    transactionDate: data.transactionDate,
    periodId: data.periodId || "",
    sourceModule: data.sourceModule || "finance",
    sourceDocumentType: data.sourceDocumentType || "",
    sourceDocumentId: data.sourceDocumentId || "",
    currency: data.currency,
    exchangeRate: data.exchangeRate,
    narration: data.narration,
    status: "draft",
    totalDebit: totals.totalDebit,
    totalCredit: totals.totalCredit,
    reversalOfJournalId: "",
    searchIndex: searchIndex(numbered.documentNumber, data.sourceDocumentId, data.narration),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(FINANCE_COLLECTIONS.journals, id, record, { exists: false }));
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record, lines }, options.session));
  await commitWrites(writes, options.idToken);
  await auditFinance(options.idToken, options.session, {
    action: "JOURNAL_CREATED",
    resource: FINANCE_COLLECTIONS.journals,
    resourceId: id,
    description: `Created journal ${numbered.documentNumber}.`,
  });
  return { id, record, lines };
}

export async function submitJournalEntry(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeJournal:submit");
  const current = await requireRecord(FINANCE_COLLECTIONS.journals, options.id, options.idToken, "Journal entry");
  assertTransition(JOURNAL_TRANSITIONS, text(current.status), "submitted", "submit");
  const { writes: approvalWrites } = await startApprovals({
    module: WORKFLOW_MODULES.journalEntry,
    documentType: "journalEntry",
    documentId: options.id,
    documentNumber: text(current.journalNumber),
    requestedBy: options.session.uid,
    session: options.session,
    idToken: options.idToken,
  });
  const next = {
    ...current,
    status: "pending_approval",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(FINANCE_COLLECTIONS.journals, options.id, next), ...approvalWrites], options.idToken);
  return { id: options.id, record: next };
}

export async function approveJournalEntry(options: {
  id: string;
  action: "approve" | "reject" | "return";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeJournal:approve");
  const current = await requireRecord(FINANCE_COLLECTIONS.journals, options.id, options.idToken, "Journal entry");
  const result = await handleApproval({
    documentId: options.id,
    action: options.action,
    comment: options.comment,
    session: options.session,
    idToken: options.idToken,
    module: WORKFLOW_MODULES.journalEntry,
  });
  const nextStatus = result.rejected ? "rejected" : result.returned ? "draft" : result.completed ? "approved" : "pending_approval";
  const next = {
    ...current,
    status: nextStatus,
    approvedBy: result.completed ? options.session.uid : current.approvedBy,
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(FINANCE_COLLECTIONS.journals, options.id, next), ...result.writes], options.idToken);
  return { id: options.id, record: next };
}

export async function postJournalEntry(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  ensurePermission(options.session, "financeJournal:post");
  const current = await requireRecord(FINANCE_COLLECTIONS.journals, options.id, options.idToken, "Journal entry");
  assertTransition(JOURNAL_TRANSITIONS, text(current.status), "posted", "post");
  await validateAccountingPeriod({
    periodId: text(current.periodId) || undefined,
    postingDate: text(current.postingDate),
    idToken: options.idToken,
  });
  const lines = await listByField(FINANCE_COLLECTIONS.journalLines, "journalId", options.id, options.idToken);
  validateJournalEntry(
    lines.map((line) => ({
      accountId: text(line.accountId),
      debit: line.debit,
      credit: line.credit,
    }))
  );
  if (text(current.sourceDocumentId) && text(current.sourceDocumentType)) {
    const posted = await queryMasterDocuments(FINANCE_COLLECTIONS.postings, options.idToken, {
      filters: [
        { field: "sourceDocumentId", value: text(current.sourceDocumentId) },
        { field: "sourceDocumentType", value: text(current.sourceDocumentType) },
      ],
      limit: 1,
    });
    if (posted.length) fail("This source document has already been posted to the ledger.");
  }
  const postingId = crypto.randomUUID();
  const next = {
    ...current,
    status: "posted",
    postedBy: options.session.uid,
    postedAt: new Date().toISOString(),
    postingRecordId: postingId,
    ...actorStamp(options.session, current),
  };
  const posting = {
    postingId,
    journalId: options.id,
    journalNumber: text(current.journalNumber),
    sourceDocumentType: text(current.sourceDocumentType),
    sourceDocumentId: text(current.sourceDocumentId),
    postingDate: text(current.postingDate),
    totalDebit: money(current.totalDebit),
    totalCredit: money(current.totalCredit),
    ...actorStamp(options.session),
  };
  await commitWrites(
    [
      writeOf(FINANCE_COLLECTIONS.journals, options.id, next),
      writeOf(FINANCE_COLLECTIONS.postings, postingId, posting, { exists: false }),
    ],
    options.idToken
  );
  await auditFinance(options.idToken, options.session, {
    action: "JOURNAL_POSTED",
    resource: FINANCE_COLLECTIONS.journals,
    resourceId: options.id,
    description: `Posted journal ${text(current.journalNumber)}.`,
    reason: options.reason,
  });
  return { id: options.id, record: next, posting };
}

export async function reverseJournalEntry(options: {
  id: string;
  reason: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeJournal:post");
  if (!options.reason?.trim()) fail("Reversal reason is required.");
  const current = await requireRecord(FINANCE_COLLECTIONS.journals, options.id, options.idToken, "Journal entry");
  assertTransition(JOURNAL_TRANSITIONS, text(current.status), "reversed", "reverse");
  const lines = await listByField(FINANCE_COLLECTIONS.journalLines, "journalId", options.id, options.idToken);
  const reversalPayload = {
    postingDate: new Date().toISOString().slice(0, 10),
    transactionDate: text(current.transactionDate),
    periodId: text(current.periodId),
    sourceModule: "finance",
    sourceDocumentType: "journal_reversal",
    sourceDocumentId: options.id,
    currency: text(current.currency) || "INR",
    exchangeRate: Number(current.exchangeRate || 1),
    narration: `Reversal of ${text(current.journalNumber)}: ${options.reason}`,
    idempotencyKey: `rev-${options.id}`,
    lines: lines.map((line) => ({
      accountId: text(line.accountId),
      debit: money(line.credit),
      credit: money(line.debit),
      costCenterId: text(line.costCenterId),
      narration: `Reversal: ${text(line.narration)}`,
    })),
  };
  const created = await createJournalEntry({
    payload: reversalPayload,
    session: options.session,
    idToken: options.idToken,
  });
  // Auto-approve and post reversal under controlled path
  await commitWrites(
    [
      writeOf(FINANCE_COLLECTIONS.journals, created.id, {
        ...created.record,
        status: "approved",
        approvedBy: options.session.uid,
        ...actorStamp(options.session, created.record),
      }),
    ],
    options.idToken
  );
  const posted = await postJournalEntry({
    id: created.id,
    session: options.session,
    idToken: options.idToken,
    reason: options.reason,
  });
  const next = {
    ...current,
    status: "reversed",
    reversalJournalId: created.id,
    reversedBy: options.session.uid,
    reversedAt: new Date().toISOString(),
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(FINANCE_COLLECTIONS.journals, options.id, next)], options.idToken);
  await auditFinance(options.idToken, options.session, {
    action: "JOURNAL_REVERSED",
    resource: FINANCE_COLLECTIONS.journals,
    resourceId: options.id,
    description: `Reversed journal ${text(current.journalNumber)}.`,
    reason: options.reason,
  });
  return { id: options.id, record: next, reversal: posted };
}

/* -------------------------------------------------------------------------- */
/* Supplier invoices / three-way match / AP                                   */
/* -------------------------------------------------------------------------- */

export async function createSupplierInvoice(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeAp:create");
  const data = parseOrFail(supplierInvoiceSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused as { id: string; record: Record<string, unknown> };
  await requireRecord("vendors", data.vendorId, options.idToken, "Supplier");
  const existing = await queryMasterDocuments(FINANCE_COLLECTIONS.supplierInvoices, options.idToken, {
    filters: [{ field: "vendorId", value: data.vendorId }],
    limit: 100,
  });
  if (
    detectDuplicateSupplierInvoice({
      existing,
      vendorId: data.vendorId,
      supplierInvoiceNumber: data.supplierInvoiceNumber,
    })
  ) {
    fail("A supplier invoice with this supplier invoice number already exists for the vendor.");
  }
  let po: Record<string, unknown> | null = null;
  let poItems: Array<Record<string, unknown>> = [];
  if (data.purchaseOrderId) {
    po = await requireRecord(PROCUREMENT_COLLECTIONS.orders, data.purchaseOrderId, options.idToken, "Purchase order");
    if (text(po.vendorId) !== data.vendorId) fail("Invoice supplier must match the purchase order vendor.");
    if (!["approved", "sent", "acknowledged", "partially_received", "fully_received", "closed"].includes(text(po.status))) {
      fail("Purchase order is not in an approved/received state for invoicing.");
    }
    poItems = await listByField(PROCUREMENT_COLLECTIONS.orderItems, "purchaseOrderId", data.purchaseOrderId, options.idToken);
  }
  const receipts = [];
  for (const receiptId of data.goodsReceiptIds) {
    const receipt = await requireRecord(INVENTORY_COLLECTIONS.receipts, receiptId, options.idToken, "Goods receipt");
    if (data.purchaseOrderId && text(receipt.purchaseOrderId) !== data.purchaseOrderId) {
      fail("Goods receipt does not belong to the selected purchase order.");
    }
    receipts.push(receipt);
  }
  const id = crypto.randomUUID();
  const numbered = await issueFinanceNumber("SINV", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const items = data.items.map((item, index) => {
    const itemId = crypto.randomUUID();
    const lineTotal = calculateLineTotal(item);
    const poLine = poItems.find((row) => text(row.materialId) === text(item.materialId));
    const record = {
      lineId: itemId,
      supplierInvoiceId: id,
      lineNumber: index + 1,
      ...item,
      lineTotal,
      poOrderedQuantity: money(poLine?.orderedQuantity),
      receivedQuantity: money(poLine?.receivedQuantity),
      previouslyInvoicedQuantity: 0,
      ...actorStamp(options.session),
    };
    writes.push(writeOf(FINANCE_COLLECTIONS.supplierInvoiceLines, itemId, record, { exists: false }));
    return record;
  });
  const totals = calculateDocumentTotals(items);
  const settings = await loadSettings(options.idToken);
  const match = matchSupplierInvoiceLines({
    lines: items.map((item) => ({
      materialId: text(item.materialId),
      quantity: money(item.quantity),
      unitPrice: money(item.unitPrice),
      poOrderedQuantity: money(item.poOrderedQuantity),
      receivedQuantity: money(item.receivedQuantity),
      previouslyInvoicedQuantity: money(item.previouslyInvoicedQuantity),
      poUnitPrice: money(poItems.find((row) => text(row.materialId) === text(item.materialId))?.unitPrice),
    })),
    qtyTolerancePercent: settings.matchQtyTolerancePercent,
    priceTolerancePercent: settings.matchPriceTolerancePercent,
    isServiceInvoice: data.isServiceInvoice,
  });
  const record = {
    supplierInvoiceId: id,
    invoiceNumber: numbered.documentNumber,
    vendorId: data.vendorId,
    supplierInvoiceNumber: data.supplierInvoiceNumber,
    purchaseOrderId: data.purchaseOrderId || "",
    goodsReceiptIds: data.goodsReceiptIds,
    invoiceDate: data.invoiceDate,
    dueDate: data.dueDate,
    currency: data.currency,
    exchangeRate: data.exchangeRate,
    isServiceInvoice: data.isServiceInvoice,
    attachmentPath: data.attachmentPath || "",
    remarks: data.remarks || "",
    matchStatus: match.status,
    matchExceptions: match.exceptions,
    matchWarnings: match.warnings,
    status: "draft",
    approvalStatus: "not_started",
    postingStatus: "unposted",
    paymentStatus: "unpaid",
    amountPaid: 0,
    creditNotesApplied: 0,
    outstandingBalance: totals.grandTotal,
    ...totals,
    searchIndex: searchIndex(numbered.documentNumber, data.supplierInvoiceNumber, data.vendorId),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(FINANCE_COLLECTIONS.supplierInvoices, id, record, { exists: false }));
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record, items }, options.session));
  await commitWrites(writes, options.idToken);
  await auditFinance(options.idToken, options.session, {
    action: "SUPPLIER_INVOICE_CREATED",
    resource: FINANCE_COLLECTIONS.supplierInvoices,
    resourceId: id,
    description: `Created supplier invoice ${numbered.documentNumber}.`,
  });
  return { id, record, items, match };
}

export async function matchSupplierInvoice(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeAp:update");
  const current = await requireRecord(FINANCE_COLLECTIONS.supplierInvoices, options.id, options.idToken, "Supplier invoice");
  assertTransition(SUPPLIER_INVOICE_TRANSITIONS, text(current.status), "matching", "match");
  const items = await listByField(FINANCE_COLLECTIONS.supplierInvoiceLines, "supplierInvoiceId", options.id, options.idToken);
  const settings = await loadSettings(options.idToken);
  let poItems: Array<Record<string, unknown>> = [];
  if (text(current.purchaseOrderId)) {
    poItems = await listByField(
      PROCUREMENT_COLLECTIONS.orderItems,
      "purchaseOrderId",
      text(current.purchaseOrderId),
      options.idToken
    );
  }
  const match = matchSupplierInvoiceLines({
    lines: items.map((item) => ({
      materialId: text(item.materialId),
      quantity: money(item.quantity),
      unitPrice: money(item.unitPrice),
      poOrderedQuantity: money(item.poOrderedQuantity),
      receivedQuantity: money(item.receivedQuantity),
      previouslyInvoicedQuantity: money(item.previouslyInvoicedQuantity),
      poUnitPrice: money(poItems.find((row) => text(row.materialId) === text(item.materialId))?.unitPrice),
    })),
    qtyTolerancePercent: settings.matchQtyTolerancePercent,
    priceTolerancePercent: settings.matchPriceTolerancePercent,
    isServiceInvoice: Boolean(current.isServiceInvoice),
  });
  const nextStatus = match.matched ? "pending_approval" : "exception_review";
  const next = {
    ...current,
    status: nextStatus,
    matchStatus: match.status,
    matchExceptions: match.exceptions,
    matchWarnings: match.warnings,
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(FINANCE_COLLECTIONS.supplierInvoices, options.id, next)], options.idToken);
  return { id: options.id, record: next, match };
}

export async function approveSupplierInvoice(options: {
  id: string;
  action: "submit" | "approve" | "reject" | "hold";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const current = await requireRecord(FINANCE_COLLECTIONS.supplierInvoices, options.id, options.idToken, "Supplier invoice");
  if (options.action === "submit") {
    ensurePermission(options.session, "financeAp:submit");
    if (text(current.matchStatus) === "exception") {
      fail("Cannot submit for approval while match exceptions exist. Route through exception review first.");
    }
    const { writes } = await startApprovals({
      module: WORKFLOW_MODULES.supplierInvoice,
      documentType: "supplierInvoice",
      documentId: options.id,
      documentNumber: text(current.invoiceNumber),
      requestedBy: options.session.uid,
      session: options.session,
      idToken: options.idToken,
    });
    const next = { ...current, status: "pending_approval", approvalStatus: "pending", ...actorStamp(options.session, current) };
    await commitWrites([writeOf(FINANCE_COLLECTIONS.supplierInvoices, options.id, next), ...writes], options.idToken);
    return { id: options.id, record: next };
  }
  if (options.action === "hold") {
    ensurePermission(options.session, "financeAp:update");
    assertTransition(SUPPLIER_INVOICE_TRANSITIONS, text(current.status), "on_hold", "hold");
    const next = { ...current, status: "on_hold", ...actorStamp(options.session, current) };
    await commitWrites([writeOf(FINANCE_COLLECTIONS.supplierInvoices, options.id, next)], options.idToken);
    return { id: options.id, record: next };
  }
  ensurePermission(options.session, "financeAp:approve");
  const result = await handleApproval({
    documentId: options.id,
    action: options.action === "approve" ? "approve" : "reject",
    comment: options.comment,
    session: options.session,
    idToken: options.idToken,
    module: WORKFLOW_MODULES.supplierInvoice,
  });
  const next = {
    ...current,
    status: result.rejected ? "rejected" : result.completed ? "approved" : "pending_approval",
    approvalStatus: result.rejected ? "rejected" : result.completed ? "approved" : "pending",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(FINANCE_COLLECTIONS.supplierInvoices, options.id, next), ...result.writes], options.idToken);
  return { id: options.id, record: next };
}

export async function postSupplierInvoice(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeJournal:post");
  const current = await requireRecord(FINANCE_COLLECTIONS.supplierInvoices, options.id, options.idToken, "Supplier invoice");
  assertTransition(SUPPLIER_INVOICE_TRANSITIONS, text(current.status), "posted", "post");
  const settings = await loadSettings(options.idToken);
  if (!settings.defaultApAccountId || !settings.defaultExpenseAccountId) {
    fail("Configure default expense and AP ledger accounts in Finance Settings before posting supplier invoices.");
  }
  if (settings.defaultApAccountId === settings.defaultExpenseAccountId) {
    fail("Expense and AP ledger accounts must be distinct.");
  }
  const journal = await createJournalEntry({
    payload: {
      postingDate: text(current.invoiceDate),
      transactionDate: text(current.invoiceDate),
      sourceModule: "finance",
      sourceDocumentType: "supplierInvoice",
      sourceDocumentId: options.id,
      currency: text(current.currency) || "INR",
      narration: `Supplier invoice ${text(current.invoiceNumber)} / ${text(current.supplierInvoiceNumber)}`,
      idempotencyKey: `post-sinv-${options.id}`,
      lines: [
        {
          accountId: settings.defaultExpenseAccountId,
          debit: money(current.grandTotal),
          credit: 0,
          narration: "Purchases / expense",
        },
        {
          accountId: settings.defaultApAccountId,
          debit: 0,
          credit: money(current.grandTotal),
          narration: "Accounts payable",
        },
      ],
    },
    session: options.session,
    idToken: options.idToken,
  });
  await commitWrites(
    [
      writeOf(FINANCE_COLLECTIONS.journals, journal.id, {
        ...journal.record,
        status: "approved",
        approvedBy: options.session.uid,
        ...actorStamp(options.session, journal.record),
      }),
    ],
    options.idToken
  );
  await postJournalEntry({ id: journal.id, session: options.session, idToken: options.idToken });
  const next = {
    ...current,
    status: "posted",
    postingStatus: "posted",
    journalId: journal.id,
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(FINANCE_COLLECTIONS.supplierInvoices, options.id, next)], options.idToken);
  return { id: options.id, record: next, journalId: journal.id };
}

export { loadSettings };
