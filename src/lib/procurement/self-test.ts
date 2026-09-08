import { strictEqual, ok, deepEqual } from "node:assert/strict";
import { checkMaterialEligibility, checkVendorEligibility } from "@/lib/procurement/eligibility";
import { calculateDocumentTotals, calculateLineTotal, maxReceivableQuantity, money } from "@/lib/procurement/money";
import { calculateRemainingPOQuantity, remainingQuantity } from "@/lib/procurement/receipts";
import { canTransition, PO_TRANSITIONS, PR_TRANSITIONS, RFQ_TRANSITIONS } from "@/lib/procurement/status";

export function runProcurementSelfTests() {
  strictEqual(money(10.126), 10.13);
  strictEqual(money("12.1"), 12.1);
  strictEqual(calculateLineTotal({ quantity: 10, unitPrice: 100, discount: 50, tax: 18, freight: 10 }), 978);
  const totals = calculateDocumentTotals([
    { quantity: 10, unitPrice: 100, discount: 0, tax: 18, freight: 0 },
    { quantity: 2, unitPrice: 50, discount: 10, tax: 0, freight: 5 },
  ]);
  strictEqual(totals.subtotal, 1100);
  strictEqual(totals.discount, 10);
  strictEqual(totals.grandTotal, 1113);

  strictEqual(maxReceivableQuantity(1000, 0), 1000);
  strictEqual(maxReceivableQuantity(1000, 5), 1050);
  strictEqual(remainingQuantity(1000, 400), 600);
  strictEqual(calculateRemainingPOQuantity([{ orderedQuantity: 1000, receivedQuantity: 400 }]), 600);
  strictEqual(calculateRemainingPOQuantity([{ orderedQuantity: 1000, receivedQuantity: 1000 }]), 0);

  ok(canTransition(PR_TRANSITIONS, "draft", "submitted"));
  ok(canTransition(PR_TRANSITIONS, "submitted", "rejected"));
  ok(canTransition(PR_TRANSITIONS, "rejected", "submitted"));
  ok(!canTransition(PR_TRANSITIONS, "completed", "draft"));
  ok(canTransition(RFQ_TRANSITIONS, "draft", "issued"));
  ok(!canTransition(RFQ_TRANSITIONS, "closed", "issued"));
  ok(canTransition(PO_TRANSITIONS, "approved", "sent"));
  ok(canTransition(PO_TRANSITIONS, "approved", "cancelled"));
  ok(!canTransition(PO_TRANSITIONS, "fully_received", "cancelled"));

  const blocked = checkVendorEligibility({
    vendor: { status: "blocked", qualificationStatus: "qualified" },
  });
  ok(!blocked.eligible);
  const active = checkVendorEligibility({
    vendor: { status: "active", qualificationStatus: "qualified" },
  });
  ok(active.eligible);
  const unmapped = checkVendorEligibility({
    vendor: { status: "active", qualificationStatus: "qualified" },
    regulatedMaterial: true,
  });
  ok(!unmapped.eligible);

  const inactiveMaterial = checkMaterialEligibility({ material: { status: "inactive", uom: "KG" } });
  ok(!inactiveMaterial.eligible);
  const goodMaterial = checkMaterialEligibility({ material: { status: "active", uom: "KG" } });
  ok(goodMaterial.eligible);

  deepEqual(PR_TRANSITIONS.draft, ["submitted", "cancelled"]);
  return "procurement self-tests passed";
}

console.log(runProcurementSelfTests());
