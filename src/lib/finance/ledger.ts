import { addMoney, debitsEqualCredits, money, toCents, fromCents } from "@/lib/finance/money";
import { fail, text } from "@/lib/finance/helpers";
import type { TrialBalanceRow } from "@/types/finance";

export function validateJournalEntry(lines: Array<{ accountId?: string; debit?: unknown; credit?: unknown }>) {
  if (lines.length < 2) fail("A journal entry requires at least two lines.");
  for (const [index, line] of lines.entries()) {
    if (!text(line.accountId)) fail(`Line ${index + 1}: account is required.`);
    const debit = money(line.debit);
    const credit = money(line.credit);
    if (debit < 0 || credit < 0) fail(`Line ${index + 1}: amounts cannot be negative.`);
    if (debit > 0 && credit > 0) fail(`Line ${index + 1}: a line cannot have both debit and credit.`);
    if (debit === 0 && credit === 0) fail(`Line ${index + 1}: enter a debit or credit amount.`);
  }
  const balanced = debitsEqualCredits(
    lines.map((line) => line.debit),
    lines.map((line) => line.credit)
  );
  if (!balanced) fail("Total debits must equal total credits before posting.");
  return {
    totalDebit: money(lines.reduce((sum, line) => addMoney(sum, line.debit), 0)),
    totalCredit: money(lines.reduce((sum, line) => addMoney(sum, line.credit), 0)),
  };
}

export function calculateTrialBalance(
  lines: Array<{
    accountId: string;
    accountCode?: string;
    accountName?: string;
    accountType?: string;
    debit?: unknown;
    credit?: unknown;
  }>
): { rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; balanced: boolean } {
  const map = new Map<string, TrialBalanceRow>();
  for (const line of lines) {
    const key = line.accountId;
    const current = map.get(key) || {
      accountId: key,
      accountCode: line.accountCode || key,
      accountName: line.accountName || key,
      accountType: line.accountType || "other",
      debit: 0,
      credit: 0,
      balance: 0,
    };
    current.debit = addMoney(current.debit, line.debit);
    current.credit = addMoney(current.credit, line.credit);
    current.balance = fromCents(toCents(current.debit) - toCents(current.credit));
    map.set(key, current);
  }
  const rows = [...map.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  const totalDebit = rows.reduce((sum, row) => addMoney(sum, row.debit), 0);
  const totalCredit = rows.reduce((sum, row) => addMoney(sum, row.credit), 0);
  return {
    rows,
    totalDebit,
    totalCredit,
    balanced: toCents(totalDebit) === toCents(totalCredit),
  };
}

export function generateProfitAndLoss(rows: TrialBalanceRow[]) {
  const revenue = rows
    .filter((row) => row.accountType === "revenue")
    .reduce((sum, row) => addMoney(sum, row.credit, -row.debit), 0);
  const expenses = rows
    .filter((row) => row.accountType === "expense")
    .reduce((sum, row) => addMoney(sum, row.debit, -row.credit), 0);
  return {
    revenue: money(revenue),
    expenses: money(expenses),
    netIncome: fromCents(toCents(revenue) - toCents(expenses)),
  };
}

export function generateBalanceSheet(rows: TrialBalanceRow[], netIncome: number) {
  const assets = rows
    .filter((row) => row.accountType === "asset")
    .reduce((sum, row) => addMoney(sum, row.debit, -row.credit), 0);
  const liabilities = rows
    .filter((row) => row.accountType === "liability")
    .reduce((sum, row) => addMoney(sum, row.credit, -row.debit), 0);
  const equity = rows
    .filter((row) => row.accountType === "equity")
    .reduce((sum, row) => addMoney(sum, row.credit, -row.debit), 0);
  const equityWithIncome = addMoney(equity, netIncome);
  return {
    assets: money(assets),
    liabilities: money(liabilities),
    equity: money(equityWithIncome),
    balanced: toCents(assets) === toCents(addMoney(liabilities, equityWithIncome)),
  };
}

export function calculateAgingBuckets(options: {
  rows: Array<{ dueDate?: string; outstandingBalance?: unknown; status?: string }>;
  asOfDate: string;
}) {
  const buckets = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
    total: 0,
  };
  for (const row of options.rows) {
    if (["cancelled", "paid", "draft"].includes(text(row.status))) continue;
    const outstanding = money(row.outstandingBalance);
    if (outstanding <= 0) continue;
    buckets.total = addMoney(buckets.total, outstanding);
    const due = text(row.dueDate);
    if (!due || due >= options.asOfDate) {
      buckets.current = addMoney(buckets.current, outstanding);
      continue;
    }
    const days = Math.floor(
      (new Date(options.asOfDate).getTime() - new Date(due).getTime()) / 86400000
    );
    if (days <= 30) buckets.days1to30 = addMoney(buckets.days1to30, outstanding);
    else if (days <= 60) buckets.days31to60 = addMoney(buckets.days31to60, outstanding);
    else if (days <= 90) buckets.days61to90 = addMoney(buckets.days61to90, outstanding);
    else buckets.days90plus = addMoney(buckets.days90plus, outstanding);
  }
  return buckets;
}
