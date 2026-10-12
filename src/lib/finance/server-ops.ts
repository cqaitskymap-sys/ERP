import { searchIndex } from "@/lib/inventory/keys";
import { SALES_COLLECTIONS } from "@/lib/sales/collections";
import { saveReceivableSnapshot } from "@/lib/sales/server";
import { queryMasterDocuments, type AtomicWrite } from "@/lib/masters/firestore";
import {
  createFinanceApprovalWrites,
  loadApprovals,
  loadWorkflowConfig,
  applyApprovalAction,
} from "@/lib/finance/approvals";
import { FINANCE_COLLECTIONS } from "@/lib/finance/collections";
import { WORKFLOW_MODULES } from "@/lib/finance/config";
import {
  actorStamp,
  auditFinance,
  canSeeFinanceSensitive,
  commitWrites,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueFinanceNumber,
  maskBankReference,
  notifyFinance,
  parseOrFail,
  requireRecord,
  reuseIdempotent,
  text,
  workflowFail,
  writeOf,
} from "@/lib/finance/helpers";
import { calculateAgingBuckets } from "@/lib/finance/ledger";
import { addMoney, calculateDocumentTotals, calculateLineTotal, money, subtractMoney } from "@/lib/finance/money";
import { periodClosingChecklist } from "@/lib/finance/periods";
import {
  createJournalEntry,
  loadSettings,
  postJournalEntry,
} from "@/lib/finance/server";
import {
  BANK_RECON_TRANSITIONS,
  CUSTOMER_INVOICE_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  PERIOD_TRANSITIONS,
  canTransition,
} from "@/lib/finance/status";
import {
  bankAccountSchema,
  bankStatementImportSchema,
  budgetSchema,
  costCenterSchema,
  creditNoteSchema,
  customerInvoiceSchema,
  customerReceiptSchema,
  debitNoteSchema,
  expenseClaimSchema,
  financePeriodSchema,
  financeSettingsSchema,
  fixedAssetSchema,
  paymentConfirmationSchema,
  paymentProposalSchema,
  taxCodeSchema,
} from "@/lib/validation/finance";
import type { SessionPayload } from "@/types/auth";

function assertTransition(map: Record<string, string[]>, current: string, next: string, action: string) {
  if (!canTransition(map, current, next)) workflowFail(current, action);
}

async function startApprovals(options: {
  module: (typeof WORKFLOW_MODULES)[keyof typeof WORKFLOW_MODULES];
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
  module: (typeof WORKFLOW_MODULES)[keyof typeof WORKFLOW_MODULES];
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

/* Payments */
export async function createPaymentProposal(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financePayment:create");
  const data = parseOrFail(paymentProposalSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireRecord("vendors", data.vendorId, options.idToken, "Supplier");
  let total = 0;
  const invoices = [];
  for (const invoiceId of data.invoiceIds) {
    const invoice = await requireRecord(FINANCE_COLLECTIONS.supplierInvoices, invoiceId, options.idToken, "Supplier invoice");
    if (text(invoice.vendorId) !== data.vendorId) fail("All invoices in a proposal must belong to the same supplier.");
    if (!["posted", "partially_paid", "approved"].includes(text(invoice.status))) {
      fail(`Invoice ${text(invoice.invoiceNumber)} is not payable in status ${text(invoice.status)}.`);
    }
    total = addMoney(total, invoice.outstandingBalance);
    invoices.push(invoice);
  }
  const id = crypto.randomUUID();
  const numbered = await issueFinanceNumber("PP", options.session, options.idToken);
  const { writes: approvalWrites } = await startApprovals({
    module: WORKFLOW_MODULES.paymentProposal,
    documentType: "paymentProposal",
    documentId: id,
    documentNumber: numbered.documentNumber,
    requestedBy: options.session.uid,
    session: options.session,
    idToken: options.idToken,
  });
  const record = {
    proposalId: id,
    proposalNumber: numbered.documentNumber,
    vendorId: data.vendorId,
    invoiceIds: data.invoiceIds,
    proposalDate: data.proposalDate,
    scheduledPaymentDate: data.scheduledPaymentDate || "",
    currency: data.currency,
    bankAccountId: data.bankAccountId || "",
    priority: data.priority,
    amount: total,
    status: "pending_approval",
    remarks: data.remarks || "",
    searchIndex: searchIndex(numbered.documentNumber, data.vendorId),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [
    writeOf(FINANCE_COLLECTIONS.paymentProposals, id, record, { exists: false }),
    ...approvalWrites,
  ];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await notifyFinance(options.idToken, options.session, {
    type: "payment_proposal_pending",
    title: "Payment proposal pending approval",
    message: `Payment proposal ${numbered.documentNumber} requires approval.`,
    resource: FINANCE_COLLECTIONS.paymentProposals,
    resourceId: id,
    audienceRoles: ["finance", "management"],
  });
  return { id, record, invoices };
}

export async function approvePaymentProposal(options: {
  id: string;
  action: "approve" | "reject";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financePayment:approve");
  const current = await requireRecord(FINANCE_COLLECTIONS.paymentProposals, options.id, options.idToken, "Payment proposal");
  const result = await handleApproval({
    documentId: options.id,
    action: options.action,
    comment: options.comment,
    session: options.session,
    idToken: options.idToken,
    module: WORKFLOW_MODULES.paymentProposal,
  });
  const next = {
    ...current,
    status: result.rejected ? "rejected" : result.completed ? "approved" : "pending_approval",
    ...actorStamp(options.session, current),
  };
  const writes: AtomicWrite[] = [writeOf(FINANCE_COLLECTIONS.paymentProposals, options.id, next), ...result.writes];
  if (result.completed) {
    const paymentId = crypto.randomUUID();
    const numbered = await issueFinanceNumber("PAY", options.session, options.idToken);
    writes.push(
      writeOf(
        FINANCE_COLLECTIONS.payments,
        paymentId,
        {
          paymentId,
          paymentNumber: numbered.documentNumber,
          proposalId: options.id,
          vendorId: text(current.vendorId),
          invoiceIds: current.invoiceIds || [],
          amount: money(current.amount),
          currency: text(current.currency) || "INR",
          bankAccountId: text(current.bankAccountId),
          status: "approved",
          executionStatus: "not_executed",
          confirmed: false,
          searchIndex: searchIndex(numbered.documentNumber, text(current.vendorId)),
          ...actorStamp(options.session),
        },
        { exists: false }
      )
    );
  }
  await commitWrites(writes, options.idToken);
  return { id: options.id, record: next };
}

export async function submitPaymentManual(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  ensurePermission(options.session, "financePayment:execute");
  const current = await requireRecord(FINANCE_COLLECTIONS.payments, options.id, options.idToken, "Payment");
  assertTransition(PAYMENT_TRANSITIONS, text(current.status), "submitted_manual", "submit");
  const next = {
    ...current,
    status: "awaiting_confirmation",
    executionStatus: "submitted_manual",
    submittedBy: options.session.uid,
    submittedAt: new Date().toISOString(),
    note: "Payment recorded as manually submitted. Not marked successful until authorized confirmation with evidence.",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(FINANCE_COLLECTIONS.payments, options.id, next)], options.idToken);
  await auditFinance(options.idToken, options.session, {
    action: "PAYMENT_SUBMITTED_MANUAL",
    resource: FINANCE_COLLECTIONS.payments,
    resourceId: options.id,
    description: `Payment ${text(current.paymentNumber)} submitted manually; awaiting confirmation.`,
    reason: options.reason,
  });
  return { id: options.id, record: next };
}

export async function recordPaymentConfirmation(options: {
  id: string;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financePayment:execute");
  const data = parseOrFail(paymentConfirmationSchema, options.payload);
  const current = await requireRecord(FINANCE_COLLECTIONS.payments, options.id, options.idToken, "Payment");
  if (!["awaiting_confirmation", "submitted_manual", "approved"].includes(text(current.status))) {
    fail(`Cannot confirm payment in "${text(current.status)}" status.`);
  }
  const settings = await loadSettings(options.idToken);
  if (settings.requireEvidenceForPaymentConfirmation && !text(data.confirmationEvidence)) {
    fail("Confirmation evidence is required before marking a payment confirmed.");
  }
  if (money(data.confirmedAmount) !== money(current.amount)) {
    fail("Confirmed amount must match the payment amount for this foundation workflow.");
  }
  // SoD: executor confirming should differ from proposal requester when possible
  if (text(current.createdBy) === options.session.uid) {
    // allow with audit warning — finance teams are small; record note
  }
  const next = {
    ...current,
    status: "confirmed",
    confirmed: true,
    paymentReference: data.paymentReference,
    confirmationDate: data.confirmationDate,
    confirmationEvidence: data.confirmationEvidence || "",
    confirmedBy: options.session.uid,
    confirmedAt: new Date().toISOString(),
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(FINANCE_COLLECTIONS.payments, options.id, next)], options.idToken);
  await auditFinance(options.idToken, options.session, {
    action: "PAYMENT_CONFIRMED",
    resource: FINANCE_COLLECTIONS.payments,
    resourceId: options.id,
    description: `Payment ${text(current.paymentNumber)} confirmed with reference ${data.paymentReference}.`,
  });
  return { id: options.id, record: next };
}

export async function postConfirmedPayment(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeJournal:post");
  const current = await requireRecord(FINANCE_COLLECTIONS.payments, options.id, options.idToken, "Payment");
  assertTransition(PAYMENT_TRANSITIONS, text(current.status), "posted", "post");
  if (!current.confirmed) fail("Payment must be confirmed before ledger posting.");
  const settings = await loadSettings(options.idToken);
  if (!settings.defaultApAccountId || !settings.defaultBankClearingAccountId) {
    fail("Configure AP and bank clearing accounts in Finance Settings before posting payments.");
  }
  const journal = await createJournalEntry({
    payload: {
      postingDate: text(current.confirmationDate) || new Date().toISOString().slice(0, 10),
      transactionDate: text(current.confirmationDate) || new Date().toISOString().slice(0, 10),
      sourceModule: "finance",
      sourceDocumentType: "payment",
      sourceDocumentId: options.id,
      currency: text(current.currency) || "INR",
      narration: `Supplier payment ${text(current.paymentNumber)}`,
      idempotencyKey: `post-pay-${options.id}`,
      lines: [
        { accountId: settings.defaultApAccountId, debit: money(current.amount), credit: 0, narration: "AP settlement" },
        {
          accountId: settings.defaultBankClearingAccountId,
          debit: 0,
          credit: money(current.amount),
          narration: "Bank / clearing",
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
  const invoiceIds = Array.isArray(current.invoiceIds) ? (current.invoiceIds as string[]) : [];
  const writes: AtomicWrite[] = [
    writeOf(FINANCE_COLLECTIONS.payments, options.id, {
      ...current,
      status: "posted",
      journalId: journal.id,
      ...actorStamp(options.session, current),
    }),
  ];
  for (const invoiceId of invoiceIds) {
    const invoice = await requireRecord(FINANCE_COLLECTIONS.supplierInvoices, invoiceId, options.idToken, "Supplier invoice");
    const paid = addMoney(invoice.amountPaid, current.amount);
    const outstanding = Math.max(0, subtractMoney(invoice.grandTotal, addMoney(paid, invoice.creditNotesApplied)));
    writes.push(
      writeOf(FINANCE_COLLECTIONS.supplierInvoices, invoiceId, {
        ...invoice,
        amountPaid: paid,
        outstandingBalance: outstanding,
        status: outstanding <= 0 ? "paid" : "partially_paid",
        paymentStatus: outstanding <= 0 ? "paid" : "partially_paid",
        ...actorStamp(options.session, invoice),
      })
    );
    const allocationId = crypto.randomUUID();
    writes.push(
      writeOf(
        FINANCE_COLLECTIONS.paymentAllocations,
        allocationId,
        {
          allocationId,
          paymentId: options.id,
          supplierInvoiceId: invoiceId,
          amount: money(current.amount),
          ...actorStamp(options.session),
        },
        { exists: false }
      )
    );
  }
  await commitWrites(writes, options.idToken);
  return { id: options.id, journalId: journal.id };
}

/* Customer invoices / AR */
export async function createCustomerInvoice(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeAr:create");
  const data = parseOrFail(customerInvoiceSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireRecord("customers", data.customerId, options.idToken, "Customer");
  if (data.salesOrderId) {
    const order = await requireRecord(SALES_COLLECTIONS.orders, data.salesOrderId, options.idToken, "Sales order");
    if (text(order.customerId) !== data.customerId) fail("Sales order customer mismatch.");
    if (!["confirmed", "ready_for_dispatch", "partially_fulfilled", "dispatched", "partially_delivered", "delivered", "closed"].includes(text(order.status))) {
      fail("Customer invoices require a commercially confirmed/dispatched sales order under configured policy.");
    }
  }
  const id = crypto.randomUUID();
  const numbered = await issueFinanceNumber("CINV", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const items = data.items.map((item, index) => {
    const itemId = crypto.randomUUID();
    const lineTotal = calculateLineTotal(item);
    const record = { lineId: itemId, customerInvoiceId: id, lineNumber: index + 1, ...item, lineTotal, ...actorStamp(options.session) };
    writes.push(writeOf(FINANCE_COLLECTIONS.customerInvoiceLines, itemId, record, { exists: false }));
    return record;
  });
  const totals = calculateDocumentTotals(items);
  const record = {
    customerInvoiceId: id,
    invoiceNumber: numbered.documentNumber,
    customerId: data.customerId,
    salesOrderId: data.salesOrderId || "",
    shipmentId: data.shipmentId || "",
    invoiceDate: data.invoiceDate,
    dueDate: data.dueDate,
    currency: data.currency,
    remarks: data.remarks || "",
    status: "draft",
    postingStatus: "unposted",
    paymentStatus: "unpaid",
    amountPaid: 0,
    creditNotesApplied: 0,
    outstandingBalance: totals.grandTotal,
    disputeStatus: "",
    ...totals,
    searchIndex: searchIndex(numbered.documentNumber, data.customerId, data.salesOrderId),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(FINANCE_COLLECTIONS.customerInvoices, id, record, { exists: false }));
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record, items }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record, items };
}

export async function approveCustomerInvoice(options: {
  id: string;
  action: "submit" | "approve" | "reject";
  comment?: string;
  session: SessionPayload;
  idToken: string;
}) {
  const current = await requireRecord(FINANCE_COLLECTIONS.customerInvoices, options.id, options.idToken, "Customer invoice");
  if (options.action === "submit") {
    ensurePermission(options.session, "financeAr:submit");
    const { writes } = await startApprovals({
      module: WORKFLOW_MODULES.customerInvoice,
      documentType: "customerInvoice",
      documentId: options.id,
      documentNumber: text(current.invoiceNumber),
      requestedBy: options.session.uid,
      session: options.session,
      idToken: options.idToken,
    });
    const next = { ...current, status: "pending_approval", ...actorStamp(options.session, current) };
    await commitWrites([writeOf(FINANCE_COLLECTIONS.customerInvoices, options.id, next), ...writes], options.idToken);
    return { id: options.id, record: next };
  }
  ensurePermission(options.session, "financeAr:approve");
  const result = await handleApproval({
    documentId: options.id,
    action: options.action === "approve" ? "approve" : "reject",
    comment: options.comment,
    session: options.session,
    idToken: options.idToken,
    module: WORKFLOW_MODULES.customerInvoice,
  });
  const next = {
    ...current,
    status: result.rejected ? "cancelled" : result.completed ? "approved" : "pending_approval",
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(FINANCE_COLLECTIONS.customerInvoices, options.id, next), ...result.writes], options.idToken);
  return { id: options.id, record: next };
}

export async function postCustomerInvoice(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeJournal:post");
  const current = await requireRecord(FINANCE_COLLECTIONS.customerInvoices, options.id, options.idToken, "Customer invoice");
  assertTransition(CUSTOMER_INVOICE_TRANSITIONS, text(current.status), "posted", "post");
  const settings = await loadSettings(options.idToken);
  if (!settings.defaultArAccountId || !settings.defaultRevenueAccountId) {
    fail("Configure default AR and revenue accounts in Finance Settings before posting customer invoices.");
  }
  const journal = await createJournalEntry({
    payload: {
      postingDate: text(current.invoiceDate),
      transactionDate: text(current.invoiceDate),
      sourceModule: "finance",
      sourceDocumentType: "customerInvoice",
      sourceDocumentId: options.id,
      currency: text(current.currency) || "INR",
      narration: `Customer invoice ${text(current.invoiceNumber)}`,
      idempotencyKey: `post-cinv-${options.id}`,
      lines: [
        { accountId: settings.defaultArAccountId, debit: money(current.grandTotal), credit: 0, narration: "Accounts receivable" },
        { accountId: settings.defaultRevenueAccountId, debit: 0, credit: money(current.grandTotal), narration: "Revenue" },
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
  await commitWrites([writeOf(FINANCE_COLLECTIONS.customerInvoices, options.id, next)], options.idToken);
  // Sync Phase 16 receivable snapshot reference
  await saveReceivableSnapshot({
    payload: {
      customerId: text(current.customerId),
      creditLimit: 0,
      outstandingBalance: money(current.outstandingBalance),
      overdueBalance: text(current.dueDate) < new Date().toISOString().slice(0, 10) ? money(current.outstandingBalance) : 0,
      currency: text(current.currency) || "INR",
      invoiceReferences: text(current.invoiceNumber),
      asOfDate: new Date().toISOString().slice(0, 10),
      source: "finance_import",
      remarks: "Updated from posted customer invoice",
      idempotencyKey: `ar-snap-${options.id}`,
    },
    session: options.session,
    idToken: options.idToken,
  }).catch(() => undefined);
  return { id: options.id, record: next, journalId: journal.id };
}

export async function allocateCustomerReceipt(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeAr:create");
  const data = parseOrFail(customerReceiptSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  if (!text(data.confirmationEvidence) && !text(data.paymentReference)) {
    fail("Record a payment reference or confirmation evidence. Receipts are not marked confirmed without authorized support.");
  }
  const allocated = data.invoiceAllocations.reduce((sum, row) => addMoney(sum, row.amount), 0);
  if (allocated > money(data.amount)) fail("Allocated amount cannot exceed receipt amount.");
  const id = crypto.randomUUID();
  const numbered = await issueFinanceNumber("RCPT", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  for (const allocation of data.invoiceAllocations) {
    const invoice = await requireRecord(
      FINANCE_COLLECTIONS.customerInvoices,
      allocation.customerInvoiceId,
      options.idToken,
      "Customer invoice"
    );
    if (text(invoice.customerId) !== data.customerId) fail("Receipt customer must match invoice customer.");
    if (text(invoice.status) !== "posted" && text(invoice.status) !== "partially_paid") {
      fail("Only posted customer invoices can receive allocations.");
    }
    const paid = addMoney(invoice.amountPaid, allocation.amount);
    const outstanding = Math.max(0, subtractMoney(invoice.grandTotal, addMoney(paid, invoice.creditNotesApplied)));
    writes.push(
      writeOf(FINANCE_COLLECTIONS.customerInvoices, allocation.customerInvoiceId, {
        ...invoice,
        amountPaid: paid,
        outstandingBalance: outstanding,
        status: outstanding <= 0 ? "paid" : "partially_paid",
        paymentStatus: outstanding <= 0 ? "paid" : "partially_paid",
        ...actorStamp(options.session, invoice),
      })
    );
  }
  const record = {
    receiptId: id,
    receiptNumber: numbered.documentNumber,
    ...data,
    confirmed: Boolean(data.confirmationEvidence || data.paymentReference),
    allocatedAmount: allocated,
    unallocatedAmount: subtractMoney(data.amount, allocated),
    status: "recorded",
    note: "Receipt recorded from authorized confirmation process. Not auto-claimed from banking rails.",
    searchIndex: searchIndex(numbered.documentNumber, data.customerId),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(FINANCE_COLLECTIONS.customerReceipts, id, record, { exists: false }));
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function createCreditNote(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeAr:create");
  const data = parseOrFail(creditNoteSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const collection =
    data.partyType === "customer" ? FINANCE_COLLECTIONS.customerInvoices : FINANCE_COLLECTIONS.supplierInvoices;
  await requireRecord(collection, data.originalInvoiceId, options.idToken, "Original invoice");
  const id = crypto.randomUUID();
  const numbered = await issueFinanceNumber("CRN", options.session, options.idToken);
  const { writes: approvalWrites } = await startApprovals({
    module: WORKFLOW_MODULES.creditNote,
    documentType: "creditNote",
    documentId: id,
    documentNumber: numbered.documentNumber,
    requestedBy: options.session.uid,
    session: options.session,
    idToken: options.idToken,
  });
  const record = {
    creditNoteId: id,
    creditNoteNumber: numbered.documentNumber,
    ...data,
    status: "pending_approval",
    postingStatus: "unposted",
    note: "Physical returns do not automatically authorize financial credit.",
    searchIndex: searchIndex(numbered.documentNumber, data.partyId, data.originalInvoiceId),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [
    writeOf(FINANCE_COLLECTIONS.creditNotes, id, record, { exists: false }),
    ...approvalWrites,
  ];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function createDebitNote(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeAp:create");
  const data = parseOrFail(debitNoteSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireRecord(FINANCE_COLLECTIONS.supplierInvoices, data.originalInvoiceId, options.idToken, "Supplier invoice");
  const id = crypto.randomUUID();
  const numbered = await issueFinanceNumber("DRN", options.session, options.idToken);
  const record = {
    debitNoteId: id,
    debitNoteNumber: numbered.documentNumber,
    ...data,
    status: "draft",
    searchIndex: searchIndex(numbered.documentNumber, data.vendorId),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(FINANCE_COLLECTIONS.debitNotes, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

/* Bank */
export async function createBankAccount(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeBank:create");
  const data = parseOrFail(bankAccountSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireRecord(FINANCE_COLLECTIONS.accounts, data.ledgerAccountId, options.idToken, "Ledger account");
  const id = crypto.randomUUID();
  const record = {
    bankAccountId: id,
    ...data,
    accountReferenceMasked: maskBankReference(data.accountReference),
    accountReference: canSeeFinanceSensitive(options.session) ? data.accountReference : maskBankReference(data.accountReference),
    searchIndex: searchIndex(data.accountName, data.bankName),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(FINANCE_COLLECTIONS.bankAccounts, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function importBankStatement(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financeBank:create");
  const data = parseOrFail(bankStatementImportSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireRecord(FINANCE_COLLECTIONS.bankAccounts, data.bankAccountId, options.idToken, "Bank account");
  const id = crypto.randomUUID();
  const writes: AtomicWrite[] = [];
  const seen = new Set<string>();
  const transactions = data.transactions.map((tx) => {
    const key = `${tx.transactionDate}|${tx.reference || ""}|${tx.debit}|${tx.credit}|${tx.description}`;
    if (seen.has(key)) fail("Duplicate transactions detected in the imported statement.");
    seen.add(key);
    const txId = crypto.randomUUID();
    const record = {
      transactionId: txId,
      statementId: id,
      bankAccountId: data.bankAccountId,
      ...tx,
      matchedPaymentId: "",
      matchedReceiptId: "",
      status: "unmatched",
      ...actorStamp(options.session),
    };
    writes.push(writeOf(FINANCE_COLLECTIONS.bankTransactions, txId, record, { exists: false }));
    return record;
  });
  const record = {
    statementId: id,
    bankAccountId: data.bankAccountId,
    statementDate: data.statementDate,
    openingBalance: money(data.openingBalance),
    closingBalance: money(data.closingBalance),
    transactionCount: transactions.length,
    status: "imported",
    source: "csv_import",
    note: "Imported statement data preserved. No live bank connectivity is claimed.",
    searchIndex: searchIndex(data.bankAccountId, data.statementDate),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(FINANCE_COLLECTIONS.bankStatements, id, record, { exists: false }));
  const reconId = crypto.randomUUID();
  const numbered = await issueFinanceNumber("BREC", options.session, options.idToken);
  writes.push(
    writeOf(
      FINANCE_COLLECTIONS.bankReconciliations,
      reconId,
      {
        reconciliationId: reconId,
        reconciliationNumber: numbered.documentNumber,
        bankAccountId: data.bankAccountId,
        statementId: id,
        status: "imported",
        ...actorStamp(options.session),
      },
      { exists: false }
    )
  );
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record, reconId }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record, reconciliationId: reconId, transactions };
}

export async function advanceBankReconciliation(options: {
  id: string;
  toStatus: string;
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  ensurePermission(options.session, "financeBank:reconcile");
  const current = await requireRecord(FINANCE_COLLECTIONS.bankReconciliations, options.id, options.idToken, "Bank reconciliation");
  assertTransition(BANK_RECON_TRANSITIONS, text(current.status), options.toStatus, options.toStatus);
  const next = { ...current, status: options.toStatus, ...actorStamp(options.session, current) };
  await commitWrites([writeOf(FINANCE_COLLECTIONS.bankReconciliations, options.id, next)], options.idToken);
  await auditFinance(options.idToken, options.session, {
    action: "BANK_RECON_STATUS",
    resource: FINANCE_COLLECTIONS.bankReconciliations,
    resourceId: options.id,
    description: `Bank reconciliation → ${options.toStatus}.`,
    reason: options.reason,
  });
  return { id: options.id, record: next };
}

/* Tax / cost centers / budgets / assets / expenses / periods / settings */
export async function createTaxCode(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "financeTax:create");
  const data = parseOrFail(taxCodeSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const record = { taxCodeId: id, ...data, version: 1, searchIndex: searchIndex(data.taxCode, data.taxName), ...actorStamp(options.session) };
  const writes: AtomicWrite[] = [writeOf(FINANCE_COLLECTIONS.taxCodes, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function createCostCenter(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "finance:update");
  const data = parseOrFail(costCenterSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const record = { costCenterId: id, ...data, searchIndex: searchIndex(data.code, data.name), ...actorStamp(options.session) };
  const writes: AtomicWrite[] = [writeOf(FINANCE_COLLECTIONS.costCenters, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function createBudget(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "financeBudget:create");
  const data = parseOrFail(budgetSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireRecord("financialYears", data.financialYearId, options.idToken, "Financial year");
  const id = crypto.randomUUID();
  const numbered = await issueFinanceNumber("BUD", options.session, options.idToken);
  const { writes: approvalWrites } = await startApprovals({
    module: WORKFLOW_MODULES.budget,
    documentType: "budget",
    documentId: id,
    documentNumber: numbered.documentNumber,
    requestedBy: options.session.uid,
    session: options.session,
    idToken: options.idToken,
  });
  const record = {
    budgetId: id,
    budgetNumber: numbered.documentNumber,
    ...data,
    actualAmount: 0,
    committedAmount: 0,
    varianceAmount: money(data.annualAmount),
    status: "pending_approval",
    searchIndex: searchIndex(numbered.documentNumber, data.name),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(FINANCE_COLLECTIONS.budgets, id, record, { exists: false }), ...approvalWrites];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function createFixedAsset(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "finance:create");
  const data = parseOrFail(fixedAssetSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const numbered = await issueFinanceNumber("FA", options.session, options.idToken);
  const monthly = money(subtractMoney(data.acquisitionCost, data.residualValue) / Math.max(1, data.usefulLifeMonths));
  const record = {
    assetId: id,
    assetCode: numbered.documentNumber,
    ...data,
    accumulatedDepreciation: 0,
    netBookValue: money(data.acquisitionCost),
    monthlyDepreciation: data.depreciationMethod === "straight_line" ? monthly : 0,
    status: "active",
    searchIndex: searchIndex(numbered.documentNumber, data.description),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(FINANCE_COLLECTIONS.fixedAssets, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function createExpenseClaim(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "finance:create");
  const data = parseOrFail(expenseClaimSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const id = crypto.randomUUID();
  const numbered = await issueFinanceNumber("EXP", options.session, options.idToken);
  const { writes: approvalWrites } = await startApprovals({
    module: WORKFLOW_MODULES.expenseClaim,
    documentType: "expenseClaim",
    documentId: id,
    documentNumber: numbered.documentNumber,
    requestedBy: options.session.uid,
    session: options.session,
    idToken: options.idToken,
  });
  const record = {
    expenseId: id,
    expenseNumber: numbered.documentNumber,
    ...data,
    status: "pending_approval",
    reimbursementStatus: "pending",
    searchIndex: searchIndex(numbered.documentNumber, data.employeeId),
    ...actorStamp(options.session),
  };
  const writes: AtomicWrite[] = [writeOf(FINANCE_COLLECTIONS.expenseClaims, id, record, { exists: false }), ...approvalWrites];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function createFinancePeriod(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "financePeriod:create");
  const data = parseOrFail(financePeriodSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireRecord("financialYears", data.financialYearId, options.idToken, "Financial year");
  if (data.endDate < data.startDate) fail("Period end date cannot be earlier than start date.");
  const id = crypto.randomUUID();
  const record = { periodId: id, ...data, searchIndex: searchIndex(data.name, data.financialYearId), ...actorStamp(options.session) };
  const writes: AtomicWrite[] = [writeOf(FINANCE_COLLECTIONS.periods, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  return { id, record };
}

export async function closeFinancialPeriod(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  ensurePermission(options.session, "financePeriod:close");
  const current = await requireRecord(FINANCE_COLLECTIONS.periods, options.id, options.idToken, "Financial period");
  assertTransition(PERIOD_TRANSITIONS, text(current.status), "closed", "close");
  const [journals, recons, invoices, payments] = await Promise.all([
    queryMasterDocuments(FINANCE_COLLECTIONS.journals, options.idToken, { limit: 200 }),
    queryMasterDocuments(FINANCE_COLLECTIONS.bankReconciliations, options.idToken, { limit: 100 }),
    queryMasterDocuments(FINANCE_COLLECTIONS.supplierInvoices, options.idToken, { limit: 200 }),
    queryMasterDocuments(FINANCE_COLLECTIONS.payments, options.idToken, { limit: 200 }),
  ]);
  const checklist = periodClosingChecklist({
    openJournals: journals.filter((row) => ["draft", "submitted", "pending_approval", "approved"].includes(text(row.status))).length,
    unreconciledStatements: recons.filter((row) => !["completed", "cancelled"].includes(text(row.status))).length,
    unapprovedInvoices: invoices.filter((row) => ["submitted", "matching", "exception_review", "pending_approval"].includes(text(row.status))).length,
    pendingPayments: payments.filter((row) => ["awaiting_confirmation", "submitted_manual", "approved"].includes(text(row.status))).length,
  });
  if (checklist.some((item) => !item.ok)) {
    fail(`Period close blocked: ${checklist.filter((item) => !item.ok).map((item) => item.label).join("; ")}`);
  }
  const closureId = crypto.randomUUID();
  const next = {
    ...current,
    status: "closed",
    closedBy: options.session.uid,
    closedAt: new Date().toISOString(),
    ...actorStamp(options.session, current),
  };
  await commitWrites(
    [
      writeOf(FINANCE_COLLECTIONS.periods, options.id, next),
      writeOf(
        FINANCE_COLLECTIONS.periodClosures,
        closureId,
        {
          closureId,
          periodId: options.id,
          checklist,
          reason: options.reason || "",
          ...actorStamp(options.session),
        },
        { exists: false }
      ),
    ],
    options.idToken
  );
  await auditFinance(options.idToken, options.session, {
    action: "PERIOD_CLOSED",
    resource: FINANCE_COLLECTIONS.periods,
    resourceId: options.id,
    description: `Closed financial period ${text(current.name)}.`,
    reason: options.reason,
  });
  return { id: options.id, record: next, checklist };
}

export async function reopenFinancialPeriod(options: {
  id: string;
  reason: string;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "financePeriod:reopen");
  if (!options.reason?.trim()) fail("Reopen justification is required.");
  const current = await requireRecord(FINANCE_COLLECTIONS.periods, options.id, options.idToken, "Financial period");
  assertTransition(PERIOD_TRANSITIONS, text(current.status), "reopened", "reopen");
  const next = {
    ...current,
    status: "reopened",
    reopenedBy: options.session.uid,
    reopenedAt: new Date().toISOString(),
    reopenReason: options.reason,
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(FINANCE_COLLECTIONS.periods, options.id, next)], options.idToken);
  await auditFinance(options.idToken, options.session, {
    action: "PERIOD_REOPENED",
    resource: FINANCE_COLLECTIONS.periods,
    resourceId: options.id,
    description: `Reopened financial period ${text(current.name)}.`,
    reason: options.reason,
    severity: "warning",
  });
  return { id: options.id, record: next };
}

export async function saveFinanceSettings(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "finance:update");
  const data = parseOrFail(financeSettingsSchema, options.payload);
  const existing = await queryMasterDocuments(FINANCE_COLLECTIONS.settings, options.idToken, { limit: 1 });
  const id = existing[0] ? String(existing[0].id) : "default";
  const record = { settingsId: id, ...data, ...actorStamp(options.session, existing[0]) };
  await commitWrites(
    [writeOf(FINANCE_COLLECTIONS.settings, id, record, { exists: existing[0] ? undefined : false })],
    options.idToken
  );
  return { id, record };
}

export async function calculateApAging(idToken: string, asOfDate = new Date().toISOString().slice(0, 10)) {
  const rows = await queryMasterDocuments(FINANCE_COLLECTIONS.supplierInvoices, idToken, { limit: 500 });
  return calculateAgingBuckets({
    rows: rows.map((row) => ({
      dueDate: text(row.dueDate),
      outstandingBalance: row.outstandingBalance,
      status: text(row.status),
    })),
    asOfDate,
  });
}

export async function calculateArAging(idToken: string, asOfDate = new Date().toISOString().slice(0, 10)) {
  const rows = await queryMasterDocuments(FINANCE_COLLECTIONS.customerInvoices, idToken, { limit: 500 });
  return calculateAgingBuckets({
    rows: rows.map((row) => ({
      dueDate: text(row.dueDate),
      outstandingBalance: row.outstandingBalance,
      status: text(row.status),
    })),
    asOfDate,
  });
}
