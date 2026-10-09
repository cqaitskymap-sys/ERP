import { FINANCE_COLLECTIONS } from "@/lib/finance/collections";
import { FINANCE_RESOURCES, type FinanceResource } from "@/lib/finance/http";
import { canSeeFinanceSensitive, listByField, maskBankReference, text } from "@/lib/finance/helpers";
import { addMoney, money } from "@/lib/finance/money";
import {
  calculateAgingBuckets,
  calculateTrialBalance,
  generateBalanceSheet,
  generateProfitAndLoss,
} from "@/lib/finance/ledger";
import { calculateApAging, calculateArAging } from "@/lib/finance/server-ops";
import {
  queryMasterDocuments,
  type MasterQueryFilter,
  type MasterRecord,
} from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";
import type { FinanceReportType } from "@/types/finance";

const SEARCH_END = "\uf8ff";

export interface FinanceListQuery {
  status?: string;
  supplierId?: string;
  customerId?: string;
  departmentId?: string;
  costCenterId?: string;
  periodId?: string;
  search?: string;
  from?: string;
  to?: string;
  pageSize?: number;
  cursor?: string;
}

function encodeCursor(values: Array<string | number>) {
  return Buffer.from(JSON.stringify(values), "utf8").toString("base64url");
}

function decodeCursor(cursor?: string) {
  if (!cursor) return undefined;
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Array<string | number>;
  } catch {
    return undefined;
  }
}

function paginate(rows: MasterRecord[], pageSize: number, cursorOf: (row: MasterRecord) => Array<string | number>) {
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null,
  };
}

function maskBankRows(rows: MasterRecord[], session: SessionPayload) {
  if (canSeeFinanceSensitive(session)) return rows;
  return rows.map((row) => ({
    ...row,
    accountReference: maskBankReference(row.accountReferenceMasked || row.accountReference),
    accountReferenceMasked: maskBankReference(row.accountReferenceMasked || row.accountReference),
  }));
}

export async function listFinanceRecords(
  resource: FinanceResource,
  query: FinanceListQuery,
  idToken: string,
  session: SessionPayload
) {
  const collection = FINANCE_RESOURCES[resource].collection;
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.supplierId) filters.push({ field: "supplierId", value: query.supplierId });
  if (query.customerId) filters.push({ field: "customerId", value: query.customerId });
  if (query.costCenterId) filters.push({ field: "costCenterId", value: query.costCenterId });
  if (query.periodId) filters.push({ field: "periodId", value: query.periodId });
  if (query.departmentId) filters.push({ field: "departmentId", value: query.departmentId });

  const search = query.search?.trim().toLowerCase();
  const cursorValues = decodeCursor(query.cursor);
  let rows: MasterRecord[];
  if (search) {
    rows = await queryMasterDocuments(collection, idToken, {
      filters: [
        ...filters,
        { field: "searchIndex", op: "GREATER_THAN_OR_EQUAL", value: search },
        { field: "searchIndex", op: "LESS_THAN", value: `${search}${SEARCH_END}` },
      ],
      orderBy: [{ field: "searchIndex" }],
      startAfter: cursorValues,
      limit: pageSize + 1,
    });
  } else {
    rows = await queryMasterDocuments(collection, idToken, {
      filters,
      orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
      startAfter: cursorValues,
      limit: pageSize + 1,
    });
  }

  if (query.from || query.to) {
    rows = rows.filter((row) => {
      const date = text(
        row.postingDate || row.invoiceDate || row.transactionDate || row.dueDate || row.createdAt
      ).slice(0, 10);
      if (query.from && date < query.from) return false;
      if (query.to && date > query.to) return false;
      return true;
    });
  }

  if (resource === "bankAccounts") rows = maskBankRows(rows, session);
  return paginate(rows, pageSize, (row) =>
    search ? [String(row.searchIndex || "")] : [String(row.updatedAt || "")]
  );
}

export async function loadFinanceDashboard(idToken: string, query: FinanceListQuery = {}) {
  const [
    supplierInvoices,
    customerInvoices,
    payments,
    paymentProposals,
    bankAccounts,
    bankReconciliations,
    journals,
    periods,
    budgets,
    journalLines,
  ] = await Promise.all([
    queryMasterDocuments(FINANCE_COLLECTIONS.supplierInvoices, idToken, { limit: 400 }),
    queryMasterDocuments(FINANCE_COLLECTIONS.customerInvoices, idToken, { limit: 400 }),
    queryMasterDocuments(FINANCE_COLLECTIONS.payments, idToken, { limit: 300 }),
    queryMasterDocuments(FINANCE_COLLECTIONS.paymentProposals, idToken, { limit: 200 }),
    queryMasterDocuments(FINANCE_COLLECTIONS.bankAccounts, idToken, { limit: 100 }),
    queryMasterDocuments(FINANCE_COLLECTIONS.bankReconciliations, idToken, { limit: 100 }),
    queryMasterDocuments(FINANCE_COLLECTIONS.journals, idToken, { limit: 300 }),
    queryMasterDocuments(FINANCE_COLLECTIONS.periods, idToken, { limit: 50 }),
    queryMasterDocuments(FINANCE_COLLECTIONS.budgets, idToken, { limit: 100 }),
    queryMasterDocuments(FINANCE_COLLECTIONS.journalLines, idToken, { limit: 800 }),
  ]);

  const inFilter = (row: MasterRecord, dateField: string) => {
    if (query.supplierId && text(row.supplierId) !== query.supplierId) return false;
    if (query.customerId && text(row.customerId) !== query.customerId) return false;
    if (query.costCenterId && text(row.costCenterId) !== query.costCenterId) return false;
    if (query.departmentId && text(row.departmentId) !== query.departmentId) return false;
    if (query.periodId && text(row.periodId) !== query.periodId) return false;
    const date = text(row[dateField] || row.createdAt).slice(0, 10);
    if (query.from && date < query.from) return false;
    if (query.to && date > query.to) return false;
    return true;
  };

  const apRows = supplierInvoices.filter((row) => inFilter(row, "invoiceDate"));
  const arRows = customerInvoices.filter((row) => inFilter(row, "invoiceDate"));
  const paymentRows = payments.filter((row) => inFilter(row, "paymentDate"));
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  const openApStatuses = ["approved", "posted", "partially_paid", "pending_approval", "matching", "exception_review"];
  const openArStatuses = ["approved", "posted", "partially_paid", "disputed"];

  const totalAp = apRows
    .filter((row) => openApStatuses.includes(text(row.status)))
    .reduce((sum, row) => addMoney(sum, row.outstandingBalance ?? row.grandTotal), 0);
  const totalAr = arRows
    .filter((row) => openArStatuses.includes(text(row.status)))
    .reduce((sum, row) => addMoney(sum, row.outstandingBalance ?? row.grandTotal), 0);

  const overdueAp = apRows.filter(
    (row) =>
      openApStatuses.includes(text(row.status)) &&
      text(row.dueDate) &&
      text(row.dueDate) < today &&
      money(row.outstandingBalance ?? row.grandTotal) > 0
  );
  const overdueAr = arRows.filter(
    (row) =>
      openArStatuses.includes(text(row.status)) &&
      text(row.dueDate) &&
      text(row.dueDate) < today &&
      money(row.outstandingBalance ?? row.grandTotal) > 0
  );

  const pendingPaymentApprovals = paymentProposals.filter((row) =>
    ["pending_approval", "proposed"].includes(text(row.status))
  );
  const paymentsCompleted = paymentRows.filter(
    (row) =>
      ["confirmed", "posted"].includes(text(row.status)) &&
      text(row.paymentDate || row.confirmedAt).slice(0, 7) === monthPrefix
  );

  const cashBankBalance = bankAccounts
    .filter((row) => text(row.status) === "active" || !row.status)
    .reduce((sum, row) => addMoney(sum, row.currentBalance ?? row.openingBalance), 0);

  const postedLines = journalLines.filter((row) => {
    const journal = journals.find((j) => String(j.id) === text(row.journalId));
    if (!journal || text(journal.status) !== "posted") return false;
    return inFilter(journal, "postingDate");
  });
  const accounts = await queryMasterDocuments(FINANCE_COLLECTIONS.accounts, idToken, { limit: 400 });
  const accountMap = new Map(accounts.map((row) => [String(row.id), row]));
  const tbLines = postedLines.map((line) => {
    const account = accountMap.get(text(line.accountId));
    return {
      accountId: text(line.accountId),
      accountCode: text(account?.accountCode || line.accountCode),
      accountName: text(account?.accountName || line.accountName),
      accountType: text(account?.accountType || line.accountType),
      debit: line.debit,
      credit: line.credit,
    };
  });
  const monthLines = postedLines.filter((line) => {
    const journal = journals.find((j) => String(j.id) === text(line.journalId));
    return text(journal?.postingDate).slice(0, 7) === monthPrefix;
  });
  const monthTb = calculateTrialBalance(
    monthLines.map((line) => {
      const account = accountMap.get(text(line.accountId));
      return {
        accountId: text(line.accountId),
        accountType: text(account?.accountType || line.accountType),
        debit: line.debit,
        credit: line.credit,
      };
    })
  );
  const pl = generateProfitAndLoss(monthTb.rows);
  const hasCostData = monthTb.rows.some((row) => row.accountType === "expense" && row.debit > 0);
  const grossMargin = hasCostData && pl.revenue > 0 ? money(((pl.revenue - pl.expenses) / pl.revenue) * 100) : null;

  const upcomingDue = [...apRows, ...arRows]
    .filter((row) => text(row.dueDate) >= today && money(row.outstandingBalance ?? row.grandTotal) > 0)
    .sort((a, b) => text(a.dueDate).localeCompare(text(b.dueDate)))
    .slice(0, 12)
    .map((row) => ({
      id: String(row.id),
      type: row.supplierId ? "supplier" : "customer",
      partyId: text(row.supplierId || row.customerId),
      documentNumber: text(row.internalNumber || row.invoiceNumber || row.documentNumber),
      dueDate: text(row.dueDate),
      outstandingBalance: money(row.outstandingBalance ?? row.grandTotal),
    }));

  const supplierAging = calculateAgingBuckets({
    rows: apRows.map((row) => ({
      dueDate: text(row.dueDate),
      outstandingBalance: row.outstandingBalance ?? row.grandTotal,
      status: text(row.status),
    })),
    asOfDate: today,
  });
  const customerAging = calculateAgingBuckets({
    rows: arRows.map((row) => ({
      dueDate: text(row.dueDate),
      outstandingBalance: row.outstandingBalance ?? row.grandTotal,
      status: text(row.status),
    })),
    asOfDate: today,
  });

  const budgetVsActual = budgets
    .filter((row) => ["approved", "active"].includes(text(row.status)))
    .slice(0, 12)
    .map((row) => ({
      id: String(row.id),
      name: text(row.name || row.budgetNumber),
      costCenterId: text(row.costCenterId),
      budgetAmount: money(row.amount || row.annualAmount),
      actualAmount: money(row.actualAmount),
      variance: money(subtractSafe(row.amount || row.annualAmount, row.actualAmount)),
    }));

  const monthlyCashFlow: Record<string, { inflow: number; outflow: number }> = {};
  for (const payment of paymentRows.filter((row) => ["confirmed", "posted"].includes(text(row.status)))) {
    const month = text(payment.paymentDate || payment.confirmedAt).slice(0, 7) || "unknown";
    monthlyCashFlow[month] ||= { inflow: 0, outflow: 0 };
    monthlyCashFlow[month].outflow = addMoney(monthlyCashFlow[month].outflow, payment.amount);
  }
  for (const receipt of await queryMasterDocuments(FINANCE_COLLECTIONS.customerReceipts, idToken, { limit: 200 })) {
    if (!inFilter(receipt, "receiptDate")) continue;
    if (!["confirmed", "posted", "allocated"].includes(text(receipt.status))) continue;
    const month = text(receipt.receiptDate || receipt.createdAt).slice(0, 7) || "unknown";
    monthlyCashFlow[month] ||= { inflow: 0, outflow: 0 };
    monthlyCashFlow[month].inflow = addMoney(monthlyCashFlow[month].inflow, receipt.amount);
  }

  const pendingReconciliations = bankReconciliations.filter(
    (row) => !["completed", "cancelled"].includes(text(row.status))
  );
  const openPeriods = periods.filter((row) => ["open", "reopened", "closing"].includes(text(row.status)));

  return {
    kpis: {
      totalAccountsPayable: money(totalAp),
      totalAccountsReceivable: money(totalAr),
      overdueSupplierInvoices: overdueAp.length,
      overdueCustomerInvoices: overdueAr.length,
      overdueSupplierAmount: money(overdueAp.reduce((s, r) => addMoney(s, r.outstandingBalance ?? r.grandTotal), 0)),
      overdueCustomerAmount: money(overdueAr.reduce((s, r) => addMoney(s, r.outstandingBalance ?? r.grandTotal), 0)),
      paymentsPendingApproval: pendingPaymentApprovals.length,
      paymentsCompletedPeriod: paymentsCompleted.length,
      paymentsCompletedAmount: money(paymentsCompleted.reduce((s, r) => addMoney(s, r.amount), 0)),
      cashAndBankBalances: money(cashBankBalance),
      monthlyRevenue: pl.revenue,
      monthlyExpenses: pl.expenses,
      grossMarginPercent: grossMargin,
      outstandingPurchaseInvoices: apRows.filter((r) => openApStatuses.includes(text(r.status))).length,
      outstandingCustomerInvoices: arRows.filter((r) => openArStatuses.includes(text(r.status))).length,
      pendingBankReconciliations: pendingReconciliations.length,
      openFinancialPeriods: openPeriods.length,
    },
    upcomingDue,
    supplierAging,
    customerAging,
    budgetVsActual,
    monthlyCashFlow: Object.entries(monthlyCashFlow)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, values]) => ({ month, ...values, net: money(values.inflow - values.outflow) })),
    pendingReconciliations: pendingReconciliations.slice(0, 10).map((row) => ({
      id: String(row.id),
      status: text(row.status),
      bankAccountId: text(row.bankAccountId),
      statementDate: text(row.statementDate || row.createdAt).slice(0, 10),
    })),
    periodStatus: openPeriods.slice(0, 8).map((row) => ({
      id: String(row.id),
      name: text(row.name || row.periodCode),
      status: text(row.status),
      startDate: text(row.startDate),
      endDate: text(row.endDate),
    })),
    trialBalanceBalanced: calculateTrialBalance(tbLines).balanced,
  };
}

function subtractSafe(left: unknown, right: unknown) {
  return money(money(left) - money(right));
}

export async function loadPendingFinanceApprovals(idToken: string) {
  const rows = await queryMasterDocuments("financeApprovals", idToken, {
    filters: [{ field: "status", value: "pending" }],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit: 100,
  });
  return { rows };
}

export async function loadFinanceReport(
  type: FinanceReportType,
  query: FinanceListQuery,
  idToken: string,
  _session: SessionPayload
) {
  const today = new Date().toISOString().slice(0, 10);
  const asOf = query.to || today;

  const inRange = (row: MasterRecord, dateField = "createdAt") => {
    const date = text(row[dateField] || row.createdAt).slice(0, 10);
    if (query.from && date < query.from) return false;
    if (query.to && date > query.to) return false;
    if (query.supplierId && text(row.supplierId) !== query.supplierId) return false;
    if (query.customerId && text(row.customerId) !== query.customerId) return false;
    if (query.costCenterId && text(row.costCenterId) !== query.costCenterId) return false;
    if (query.periodId && text(row.periodId) !== query.periodId) return false;
    return true;
  };

  let rows: MasterRecord[] = [];
  let grouped: Record<string, number> | undefined;
  let meta: Record<string, unknown> | undefined;

  switch (type) {
    case "general_ledger":
    case "journal_register": {
      const journals = await queryMasterDocuments(FINANCE_COLLECTIONS.journals, idToken, { limit: 500 });
      rows = journals.filter((row) => inRange(row, "postingDate") && text(row.status) === "posted");
      break;
    }
    case "trial_balance": {
      const [lines, accounts, journals] = await Promise.all([
        queryMasterDocuments(FINANCE_COLLECTIONS.journalLines, idToken, { limit: 1000 }),
        queryMasterDocuments(FINANCE_COLLECTIONS.accounts, idToken, { limit: 500 }),
        queryMasterDocuments(FINANCE_COLLECTIONS.journals, idToken, { limit: 500 }),
      ]);
      const postedIds = new Set(
        journals.filter((j) => text(j.status) === "posted" && inRange(j, "postingDate")).map((j) => String(j.id))
      );
      const accountMap = new Map(accounts.map((a) => [String(a.id), a]));
      const tb = calculateTrialBalance(
        lines
          .filter((line) => postedIds.has(text(line.journalId)))
          .map((line) => {
            const account = accountMap.get(text(line.accountId));
            return {
              accountId: text(line.accountId),
              accountCode: text(account?.accountCode || line.accountCode),
              accountName: text(account?.accountName || line.accountName),
              accountType: text(account?.accountType || line.accountType),
              debit: line.debit,
              credit: line.credit,
            };
          })
      );
      rows = tb.rows.map((row) => ({ id: row.accountId, ...row }));
      meta = { totalDebit: tb.totalDebit, totalCredit: tb.totalCredit, balanced: tb.balanced };
      break;
    }
    case "profit_and_loss": {
      const report = await loadFinanceReport("trial_balance", query, idToken, _session);
      const tbRows = report.rows as Array<MasterRecord & { accountType?: string; debit?: number; credit?: number; balance?: number }>;
      const pl = generateProfitAndLoss(
        tbRows.map((row) => ({
          accountId: String(row.id),
          accountCode: text(row.accountCode),
          accountName: text(row.accountName),
          accountType: text(row.accountType),
          debit: money(row.debit),
          credit: money(row.credit),
          balance: money(row.balance),
        }))
      );
      rows = [
        { id: "revenue", label: "Revenue", value: pl.revenue },
        { id: "expenses", label: "Expenses", value: pl.expenses },
        { id: "net_income", label: "Net income", value: pl.netIncome },
      ];
      meta = pl;
      break;
    }
    case "balance_sheet": {
      const report = await loadFinanceReport("trial_balance", query, idToken, _session);
      const tbRows = report.rows as Array<MasterRecord & { accountType?: string; debit?: number; credit?: number; balance?: number }>;
      const mapped = tbRows.map((row) => ({
        accountId: String(row.id),
        accountCode: text(row.accountCode),
        accountName: text(row.accountName),
        accountType: text(row.accountType),
        debit: money(row.debit),
        credit: money(row.credit),
        balance: money(row.balance),
      }));
      const pl = generateProfitAndLoss(mapped);
      const bs = generateBalanceSheet(mapped, pl.netIncome);
      rows = [
        { id: "assets", label: "Assets", value: bs.assets },
        { id: "liabilities", label: "Liabilities", value: bs.liabilities },
        { id: "equity", label: "Equity (incl. net income)", value: bs.equity },
      ];
      meta = bs;
      break;
    }
    case "cash_flow": {
      const [payments, receipts] = await Promise.all([
        queryMasterDocuments(FINANCE_COLLECTIONS.payments, idToken, { limit: 400 }),
        queryMasterDocuments(FINANCE_COLLECTIONS.customerReceipts, idToken, { limit: 400 }),
      ]);
      grouped = {};
      for (const payment of payments.filter(
        (row) => inRange(row, "paymentDate") && ["confirmed", "posted"].includes(text(row.status))
      )) {
        const key = text(payment.paymentDate).slice(0, 7) || "unknown";
        grouped[key] = money((grouped[key] || 0) - money(payment.amount));
      }
      for (const receipt of receipts.filter(
        (row) => inRange(row, "receiptDate") && ["confirmed", "posted", "allocated"].includes(text(row.status))
      )) {
        const key = text(receipt.receiptDate).slice(0, 7) || "unknown";
        grouped[key] = money((grouped[key] || 0) + money(receipt.amount));
      }
      rows = Object.entries(grouped).map(([period, value]) => ({ id: period, period, netCash: value }));
      break;
    }
    case "ap_aging": {
      const buckets = await calculateApAging(idToken, asOf);
      rows = Object.entries(buckets).map(([bucket, amount]) => ({ id: bucket, bucket, amount }));
      meta = { buckets };
      break;
    }
    case "ar_aging": {
      const buckets = await calculateArAging(idToken, asOf);
      rows = Object.entries(buckets).map(([bucket, amount]) => ({ id: bucket, bucket, amount }));
      meta = { buckets };
      break;
    }
    case "supplier_statement": {
      const invoices = await queryMasterDocuments(FINANCE_COLLECTIONS.supplierInvoices, idToken, { limit: 400 });
      rows = invoices.filter((row) => inRange(row, "invoiceDate") && (!query.supplierId || text(row.supplierId) === query.supplierId));
      break;
    }
    case "customer_statement": {
      const invoices = await queryMasterDocuments(FINANCE_COLLECTIONS.customerInvoices, idToken, { limit: 400 });
      rows = invoices.filter((row) => inRange(row, "invoiceDate") && (!query.customerId || text(row.customerId) === query.customerId));
      break;
    }
    case "purchase_invoice_register": {
      const invoices = await queryMasterDocuments(FINANCE_COLLECTIONS.supplierInvoices, idToken, { limit: 500 });
      rows = invoices.filter((row) => inRange(row, "invoiceDate"));
      break;
    }
    case "sales_invoice_register": {
      const invoices = await queryMasterDocuments(FINANCE_COLLECTIONS.customerInvoices, idToken, { limit: 500 });
      rows = invoices.filter((row) => inRange(row, "invoiceDate"));
      break;
    }
    case "payment_register": {
      const payments = await queryMasterDocuments(FINANCE_COLLECTIONS.payments, idToken, { limit: 500 });
      rows = payments.filter((row) => inRange(row, "paymentDate"));
      break;
    }
    case "bank_reconciliation": {
      const recons = await queryMasterDocuments(FINANCE_COLLECTIONS.bankReconciliations, idToken, { limit: 200 });
      rows = recons.filter((row) => inRange(row, "createdAt"));
      break;
    }
    case "tax_summary": {
      const invoices = await queryMasterDocuments(FINANCE_COLLECTIONS.supplierInvoices, idToken, { limit: 400 });
      const customer = await queryMasterDocuments(FINANCE_COLLECTIONS.customerInvoices, idToken, { limit: 400 });
      grouped = {};
      for (const row of [...invoices, ...customer].filter((r) => inRange(r, "invoiceDate"))) {
        const key = text(row.taxCodeId || "unassigned");
        grouped[key] = money((grouped[key] || 0) + money(row.taxTotal || row.tax));
      }
      rows = Object.entries(grouped).map(([taxCodeId, taxAmount]) => ({ id: taxCodeId, taxCodeId, taxAmount }));
      break;
    }
    case "cost_center": {
      const lines = await queryMasterDocuments(FINANCE_COLLECTIONS.journalLines, idToken, { limit: 800 });
      grouped = {};
      for (const line of lines) {
        if (query.costCenterId && text(line.costCenterId) !== query.costCenterId) continue;
        const key = text(line.costCenterId) || "unassigned";
        grouped[key] = money((grouped[key] || 0) + money(line.debit) - money(line.credit));
      }
      rows = Object.entries(grouped).map(([costCenterId, amount]) => ({ id: costCenterId, costCenterId, amount }));
      break;
    }
    case "budget_vs_actual": {
      const budgets = await queryMasterDocuments(FINANCE_COLLECTIONS.budgets, idToken, { limit: 200 });
      rows = budgets
        .filter((row) => ["approved", "active"].includes(text(row.status)))
        .map((row) => ({
          ...row,
          budgetAmount: money(row.amount || row.annualAmount),
          actualAmount: money(row.actualAmount),
          variance: money(money(row.amount || row.annualAmount) - money(row.actualAmount)),
        }));
      break;
    }
    case "fixed_asset_register": {
      const assets = await queryMasterDocuments(FINANCE_COLLECTIONS.fixedAssets, idToken, { limit: 300 });
      rows = assets.filter((row) => inRange(row, "acquisitionDate"));
      break;
    }
    case "period_closing": {
      const closures = await queryMasterDocuments(FINANCE_COLLECTIONS.periodClosures, idToken, { limit: 100 });
      const periods = await queryMasterDocuments(FINANCE_COLLECTIONS.periods, idToken, { limit: 100 });
      rows = [...closures, ...periods].filter((row) => inRange(row, "createdAt"));
      break;
    }
    default: {
      const journals = await queryMasterDocuments(FINANCE_COLLECTIONS.journals, idToken, { limit: 200 });
      rows = journals.filter((row) => inRange(row, "postingDate"));
    }
  }

  return { rows, nextCursor: null, grouped, meta };
}

export async function loadLedgerLinesForJournal(journalId: string, idToken: string) {
  return listByField(FINANCE_COLLECTIONS.journalLines, "journalId", journalId, idToken);
}
