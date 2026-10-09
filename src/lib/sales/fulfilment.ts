import { queryMasterDocuments } from "@/lib/masters/firestore";
import { LOGISTICS_COLLECTIONS } from "@/lib/logistics/collections";
import { SALES_COLLECTIONS } from "@/lib/sales/collections";
import { calculateFulfilmentPercent, money } from "@/lib/sales/money";
import { listByField, text } from "@/lib/sales/helpers";
import type { FulfilmentTotals, SalesOrderBlocker } from "@/types/sales";

export function calculateLineFulfilment(line: Record<string, unknown>): FulfilmentTotals {
  const orderedQuantity = money(line.orderedQuantity ?? line.quantity);
  const reservedQuantity = money(line.reservedQuantity);
  const allocatedQuantity = money(line.allocatedQuantity);
  const pickedQuantity = money(line.pickedQuantity);
  const dispatchedQuantity = money(line.dispatchedQuantity);
  const deliveredQuantity = money(line.deliveredQuantity);
  const remainingQuantity = money(
    Math.max(0, orderedQuantity - Math.max(dispatchedQuantity, deliveredQuantity, allocatedQuantity))
  );
  return {
    orderedQuantity,
    reservedQuantity,
    allocatedQuantity,
    pickedQuantity,
    dispatchedQuantity,
    deliveredQuantity,
    remainingQuantity,
    fulfilmentPercent: calculateFulfilmentPercent(
      orderedQuantity,
      Math.max(deliveredQuantity, dispatchedQuantity)
    ),
  };
}

export function calculateOrderFulfilment(lines: Array<Record<string, unknown>>): FulfilmentTotals {
  const totals = lines.reduce<FulfilmentTotals>(
    (acc, line) => {
      const f = calculateLineFulfilment(line);
      return {
        orderedQuantity: money(acc.orderedQuantity + f.orderedQuantity),
        reservedQuantity: money(acc.reservedQuantity + f.reservedQuantity),
        allocatedQuantity: money(acc.allocatedQuantity + f.allocatedQuantity),
        pickedQuantity: money(acc.pickedQuantity + f.pickedQuantity),
        dispatchedQuantity: money(acc.dispatchedQuantity + f.dispatchedQuantity),
        deliveredQuantity: money(acc.deliveredQuantity + f.deliveredQuantity),
        remainingQuantity: money(acc.remainingQuantity + f.remainingQuantity),
        fulfilmentPercent: 0,
      };
    },
    {
      orderedQuantity: 0,
      reservedQuantity: 0,
      allocatedQuantity: 0,
      pickedQuantity: 0,
      dispatchedQuantity: 0,
      deliveredQuantity: 0,
      remainingQuantity: 0,
      fulfilmentPercent: 0,
    }
  );
  totals.fulfilmentPercent = calculateFulfilmentPercent(
    totals.orderedQuantity,
    Math.max(totals.deliveredQuantity, totals.dispatchedQuantity)
  );
  return totals;
}

export async function loadOrderLogisticsLinks(salesOrderId: string, idToken: string) {
  const [reservations, shipments, allocations] = await Promise.all([
    queryMasterDocuments(LOGISTICS_COLLECTIONS.reservations, idToken, {
      filters: [{ field: "orderId", value: salesOrderId }],
      limit: 100,
    }).catch(() => []),
    queryMasterDocuments(LOGISTICS_COLLECTIONS.shipments, idToken, {
      filters: [{ field: "salesOrderId", value: salesOrderId }],
      limit: 50,
    }).catch(() =>
      queryMasterDocuments(LOGISTICS_COLLECTIONS.shipments, idToken, {
        filters: [{ field: "orderId", value: salesOrderId }],
        limit: 50,
      }).catch(() => [])
    ),
    listByField(SALES_COLLECTIONS.orderAllocations, "salesOrderId", salesOrderId, idToken, 100),
  ]);
  return { reservations, shipments, allocations };
}

export function deriveOrderBlockers(options: {
  order: Record<string, unknown>;
  creditAllowed: boolean;
  creditReasons: string[];
  requirementBlockers: SalesOrderBlocker[];
  stockShortages: string[];
  pendingApprovals: number;
}): SalesOrderBlocker[] {
  const blockers: SalesOrderBlocker[] = [...options.requirementBlockers];
  const status = text(options.order.status);
  if (options.pendingApprovals > 0 && ["submitted", "under_review", "pending_approval"].includes(status)) {
    blockers.push({
      code: "pending_approval",
      label: `${options.pendingApprovals} commercial approval step(s) pending.`,
      severity: "blocking",
    });
  }
  if (!options.creditAllowed) {
    for (const reason of options.creditReasons) {
      blockers.push({ code: "credit_hold", label: reason, severity: "blocking" });
    }
  }
  for (const shortage of options.stockShortages) {
    blockers.push({
      code: "insufficient_stock",
      label: shortage,
      severity: "warning",
    });
  }
  if (text(options.order.regulatoryHold)) {
    blockers.push({
      code: "regulatory_hold",
      label: text(options.order.regulatoryHold),
      severity: "blocking",
    });
  }
  if (text(options.order.documentationHold)) {
    blockers.push({
      code: "missing_documents",
      label: text(options.order.documentationHold),
      severity: "blocking",
    });
  }
  return blockers;
}

export function canCloseOrder(order: Record<string, unknown>, fulfilment: FulfilmentTotals) {
  const status = text(order.status);
  if (!["delivered", "partially_delivered", "dispatched"].includes(status) && fulfilment.remainingQuantity > 0) {
    return {
      allowed: false,
      reason: "Order still has remaining quantity and is not in a delivery-complete status.",
    };
  }
  if (text(order.approvalStatus) === "pending") {
    return { allowed: false, reason: "Pending approvals must be resolved before closure." };
  }
  return { allowed: true, reason: "" };
}
