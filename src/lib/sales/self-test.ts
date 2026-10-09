import { strictEqual, ok, deepEqual } from "node:assert/strict";
import {
  calculateDocumentTotals,
  calculateFulfilmentPercent,
  calculateLineTotal,
  discountPercent,
  money,
} from "@/lib/sales/money";
import { requiresDiscountApproval, isPriceRuleEffective, selectTierPrice } from "@/lib/sales/pricing";
import { calculateLineFulfilment, calculateOrderFulfilment, canCloseOrder } from "@/lib/sales/fulfilment";
import {
  canTransition,
  ORDER_TRANSITIONS,
  QUOTATION_TRANSITIONS,
  RETURN_TRANSITIONS,
  isLockedOrderStatus,
} from "@/lib/sales/status";
import { filterOrderApprovalSteps } from "@/lib/sales/approvals";

export function runSalesSelfTests() {
  strictEqual(money(10.126), 10.13);
  strictEqual(calculateLineTotal({ quantity: 10, unitPrice: 100, discount: 50, tax: 18, freight: 10 }), 978);
  const totals = calculateDocumentTotals([
    { quantity: 10, unitPrice: 100, discount: 0, tax: 18, freight: 0 },
    { quantity: 2, unitPrice: 50, discount: 10, tax: 0, freight: 5 },
  ]);
  strictEqual(totals.subtotal, 1100);
  strictEqual(totals.discount, 10);
  strictEqual(totals.grandTotal, 1113);
  strictEqual(discountPercent(1000, 50), 5);
  ok(requiresDiscountApproval(1000, 60, 5));
  ok(!requiresDiscountApproval(1000, 40, 5));
  strictEqual(calculateFulfilmentPercent(100, 40), 40);

  ok(isPriceRuleEffective({ effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31" }, "2026-06-01"));
  ok(!isPriceRuleEffective({ effectiveFrom: "2026-07-01" }, "2026-06-01"));
  const tier = selectTierPrice(
    [
      { productId: "p1", minQuantity: 1, unitPrice: 100, effectiveFrom: "2026-01-01" },
      { productId: "p1", minQuantity: 50, unitPrice: 90, effectiveFrom: "2026-01-01" },
    ],
    "p1",
    60,
    "2026-06-01"
  );
  strictEqual(money(tier?.unitPrice), 90);

  ok(canTransition(QUOTATION_TRANSITIONS, "draft", "internal_review"));
  ok(canTransition(QUOTATION_TRANSITIONS, "accepted", "converted"));
  ok(!canTransition(QUOTATION_TRANSITIONS, "converted", "draft"));
  ok(canTransition(ORDER_TRANSITIONS, "draft", "submitted"));
  ok(canTransition(ORDER_TRANSITIONS, "approved", "confirmed"));
  ok(!canTransition(ORDER_TRANSITIONS, "delivered", "draft"));
  ok(canTransition(RETURN_TRANSITIONS, "requested", "sales_review"));
  ok(isLockedOrderStatus("dispatched"));
  ok(!isLockedOrderStatus("confirmed"));

  const fulfilment = calculateOrderFulfilment([
    {
      orderedQuantity: 100,
      reservedQuantity: 40,
      allocatedQuantity: 40,
      pickedQuantity: 20,
      dispatchedQuantity: 20,
      deliveredQuantity: 10,
    },
  ]);
  strictEqual(fulfilment.remainingQuantity, 60);
  strictEqual(fulfilment.fulfilmentPercent, 20);
  const line = calculateLineFulfilment({ quantity: 50, dispatchedQuantity: 50, deliveredQuantity: 50 });
  strictEqual(line.remainingQuantity, 0);

  const closureBlocked = canCloseOrder({ status: "confirmed", approvalStatus: "approved" }, fulfilment);
  ok(!closureBlocked.allowed);
  const closureOk = canCloseOrder({ status: "delivered", approvalStatus: "approved" }, {
    ...fulfilment,
    remainingQuantity: 0,
  });
  ok(closureOk.allowed);

  const steps = filterOrderApprovalSteps(
    [
      { sequence: 1, role: "sales", approvalType: "approve", required: true, label: "Sales" },
      { sequence: 2, role: "finance", approvalType: "approve", required: false, label: "Finance" },
      { sequence: 3, role: "qa", approvalType: "approve", required: false, label: "QA" },
    ],
    { requireFinance: false, requireQa: false }
  );
  strictEqual(steps.length, 1);
  deepEqual(
    ORDER_TRANSITIONS.draft,
    ["submitted", "cancelled"]
  );

  return "sales self-tests passed";
}

console.log(runSalesSelfTests());
