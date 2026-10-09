import { strictEqual, ok, deepEqual } from "node:assert/strict";
import {
  addMoney,
  calculateDocumentTotals,
  calculateLineTotal,
  debitsEqualCredits,
  money,
  toCents,
} from "@/lib/finance/money";
import { validateJournalEntry, calculateTrialBalance, generateProfitAndLoss, generateBalanceSheet, calculateAgingBuckets } from "@/lib/finance/ledger";
import { matchSupplierInvoiceLines, detectDuplicateSupplierInvoice } from "@/lib/finance/matching";
import { calculateTaxBreakdown, splitGstComponents, isTaxEffective } from "@/lib/finance/tax";
import {
  canTransition,
  JOURNAL_TRANSITIONS,
  SUPPLIER_INVOICE_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  PERIOD_TRANSITIONS,
} from "@/lib/finance/status";

export function runFinanceSelfTests() {
  strictEqual(money(10.126), 10.13);
  strictEqual(toCents(10.13), 1013);
  strictEqual(addMoney(10.1, 0.2), 10.3);
  ok(debitsEqualCredits([100, 50], [150]));
  ok(!debitsEqualCredits([100], [99.99]));

  const line = calculateLineTotal({ quantity: 10, unitPrice: 100, discount: 50, tax: 18, freight: 10 });
  strictEqual(line, 978);
  const totals = calculateDocumentTotals([
    { quantity: 10, unitPrice: 100, discount: 0, tax: 18, freight: 0 },
    { quantity: 2, unitPrice: 50, discount: 10, tax: 0, freight: 5 },
  ]);
  strictEqual(totals.grandTotal, 1113);

  const balanced = validateJournalEntry([
    { accountId: "a1", debit: 100, credit: 0 },
    { accountId: "a2", debit: 0, credit: 100 },
  ]);
  strictEqual(balanced.totalDebit, 100);
  strictEqual(balanced.totalCredit, 100);

  let threw = false;
  try {
    validateJournalEntry([
      { accountId: "a1", debit: 100, credit: 0 },
      { accountId: "a2", debit: 0, credit: 90 },
    ]);
  } catch {
    threw = true;
  }
  ok(threw);

  const tb = calculateTrialBalance([
    { accountId: "1", accountCode: "1000", accountName: "Cash", accountType: "asset", debit: 500, credit: 0 },
    { accountId: "2", accountCode: "4000", accountName: "Sales", accountType: "revenue", debit: 0, credit: 500 },
  ]);
  ok(tb.balanced);
  const pl = generateProfitAndLoss(tb.rows);
  strictEqual(pl.revenue, 500);
  const bs = generateBalanceSheet(tb.rows, pl.netIncome);
  ok(bs.balanced);

  const matchOk = matchSupplierInvoiceLines({
    lines: [
      {
        quantity: 10,
        unitPrice: 100,
        poOrderedQuantity: 10,
        receivedQuantity: 10,
        qcAcceptedQuantity: 10,
        previouslyInvoicedQuantity: 0,
        poUnitPrice: 100,
      },
    ],
  });
  ok(matchOk.matched);
  strictEqual(matchOk.status, "matched");

  const matchFail = matchSupplierInvoiceLines({
    lines: [
      {
        quantity: 12,
        unitPrice: 120,
        poOrderedQuantity: 10,
        receivedQuantity: 10,
        qcAcceptedQuantity: 10,
        previouslyInvoicedQuantity: 0,
        poUnitPrice: 100,
      },
    ],
    qtyTolerancePercent: 0,
    priceTolerancePercent: 0,
  });
  ok(!matchFail.matched);
  ok(matchFail.exceptions.length >= 1);

  const dup = detectDuplicateSupplierInvoice({
    existing: [{ vendorId: "s1", supplierInvoiceNumber: "INV-1", status: "posted" }],
    vendorId: "s1",
    supplierInvoiceNumber: "INV-1",
  });
  ok(dup);

  ok(isTaxEffective({ effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31", status: "active" }, "2026-06-01"));
  const tax = calculateTaxBreakdown({
    taxableAmount: 1000,
    ratePercent: 18,
    taxCodeId: "gst18",
    taxCode: "GST18",
    taxType: "gst",
  });
  strictEqual(tax.taxAmount, 180);
  const gst = splitGstComponents({ taxableAmount: 1000, gstRatePercent: 18, sameState: true });
  strictEqual(gst.cgst, 90);
  strictEqual(gst.sgst, 90);
  strictEqual(gst.igst, 0);

  ok(canTransition(JOURNAL_TRANSITIONS, "draft", "submitted"));
  ok(canTransition(JOURNAL_TRANSITIONS, "approved", "posted"));
  ok(!canTransition(JOURNAL_TRANSITIONS, "posted", "draft"));
  ok(canTransition(SUPPLIER_INVOICE_TRANSITIONS, "draft", "submitted"));
  ok(canTransition(PAYMENT_TRANSITIONS, "approved", "submitted_manual"));
  ok(canTransition(PERIOD_TRANSITIONS, "open", "closing"));
  ok(canTransition(PERIOD_TRANSITIONS, "closed", "reopened"));

  const aging = calculateAgingBuckets({
    rows: [
      { dueDate: "2026-10-01", outstandingBalance: 100, status: "posted" },
      { dueDate: "2026-09-01", outstandingBalance: 200, status: "posted" },
      { dueDate: "2026-07-01", outstandingBalance: 50, status: "posted" },
      { dueDate: "2026-01-01", outstandingBalance: 25, status: "paid" },
    ],
    asOfDate: "2026-10-09",
  });
  strictEqual(aging.total, 350);
  ok(aging.days1to30 >= 100);

  deepEqual(JOURNAL_TRANSITIONS.posted, ["reversed"]);

  return "finance self-tests passed";
}

console.log(runFinanceSelfTests());
