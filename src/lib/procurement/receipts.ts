import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import { roundQuantity } from "@/lib/inventory/keys";
import { DEFAULT_OVER_RECEIPT_TOLERANCE_PERCENT } from "@/lib/procurement/config";
import { PROCUREMENT_COLLECTIONS } from "@/lib/procurement/collections";
import { maxReceivableQuantity, money } from "@/lib/procurement/money";
import { actorStamp, fail, listByField, text, writeOf } from "@/lib/procurement/helpers";
import { queryMasterDocuments, readMasterDocument, type AtomicWrite, type MasterRecord } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";

export function remainingQuantity(ordered: unknown, received: unknown) {
  return money(Math.max(0, money(ordered) - money(received)));
}

export function calculateRemainingPOQuantity(items: Array<Record<string, unknown>>) {
  return items.reduce(
    (sum, item) => sum + remainingQuantity(item.orderedQuantity, item.receivedQuantity),
    0
  );
}

export async function loadPoWithItems(purchaseOrderId: string, idToken: string) {
  const order = await readMasterDocument(PROCUREMENT_COLLECTIONS.orders, purchaseOrderId, idToken);
  if (!order) fail("Purchase order was not found.");
  const items = await listByField(PROCUREMENT_COLLECTIONS.orderItems, "purchaseOrderId", purchaseOrderId, idToken);
  return { order, items };
}

export function assertReceivableStatus(status: string) {
  if (!["approved", "sent", "acknowledged", "partially_received"].includes(status)) {
    fail(`Purchase order status "${status}" cannot be received.`);
  }
}

export function validateReceiptAgainstPo(options: {
  order: MasterRecord;
  items: MasterRecord[];
  receiptItems: Array<{ materialId?: string; purchaseOrderItemId?: string; quantity: number }>;
  overReceiptApproved?: boolean;
}) {
  const tolerance = Number(options.order.overReceiptTolerancePercent ?? DEFAULT_OVER_RECEIPT_TOLERANCE_PERCENT);
  const warnings: string[] = [];
  for (const line of options.receiptItems) {
    const poItem = options.items.find(
      (item) =>
        (line.purchaseOrderItemId && String(item.id) === line.purchaseOrderItemId) ||
        text(item.materialId) === text(line.materialId)
    );
    if (!poItem) fail("A receipt line does not match the selected purchase order.");
    const ordered = money(poItem.orderedQuantity);
    const already = money(poItem.receivedQuantity);
    const next = money(already + money(line.quantity));
    const max = maxReceivableQuantity(ordered, tolerance);
    if (next > max) {
      if (!options.overReceiptApproved) {
        fail(
          `Over-receipt exceeds configured tolerance for ${text(poItem.materialId)}. Ordered ${ordered}, already received ${already}, maximum ${max}.`
        );
      }
      warnings.push(`Over-receipt approved for ${text(poItem.materialId)}.`);
    } else if (next > ordered) {
      warnings.push(`Receipt uses configured tolerance for ${text(poItem.materialId)}.`);
    }
  }
  return { warnings, tolerance };
}

export async function applyPurchaseOrderReceipt(options: {
  purchaseOrderId: string;
  receiptId: string;
  receiptNumber: string;
  receiptItems: MasterRecord[];
  session: SessionPayload;
  idToken: string;
  overReceiptApproved?: boolean;
}): Promise<{
  writes: AtomicWrite[];
  nextStatus: string;
  remaining: number;
  expectedDeliveryDate: string;
  vendorId: string;
  orderedQuantity: number;
  receivedThisTime: number;
}> {
  const { order, items } = await loadPoWithItems(options.purchaseOrderId, options.idToken);
  assertReceivableStatus(text(order.status));
  validateReceiptAgainstPo({
    order,
    items,
    receiptItems: options.receiptItems.map((item) => ({
      materialId: text(item.materialId),
      purchaseOrderItemId: text(item.purchaseOrderItemId),
      quantity: Number(item.quantity || 0),
    })),
    overReceiptApproved: options.overReceiptApproved,
  });

  const writes: AtomicWrite[] = [];
  const now = new Date().toISOString();
  let remaining = 0;
  for (const poItem of items) {
    const matched = options.receiptItems.filter(
      (item) =>
        text(item.purchaseOrderItemId) === String(poItem.id) ||
        (!text(item.purchaseOrderItemId) && text(item.materialId) === text(poItem.materialId))
    );
    const added = matched.reduce((sum, item) => sum + money(item.quantity), 0);
    const receivedQuantity = money(money(poItem.receivedQuantity) + added);
    remaining += remainingQuantity(poItem.orderedQuantity, receivedQuantity);
    writes.push(
      writeOf(PROCUREMENT_COLLECTIONS.orderItems, String(poItem.id), {
        ...poItem,
        receivedQuantity,
        updatedBy: options.session.uid,
        updatedAt: now,
      })
    );
  }

  const nextStatus = remaining <= 0 ? "fully_received" : "partially_received";
  writes.push(
    writeOf(PROCUREMENT_COLLECTIONS.orders, options.purchaseOrderId, {
      ...order,
      ...actorStamp(options.session, order),
      status: nextStatus,
      lastReceiptId: options.receiptId,
      lastReceiptNumber: options.receiptNumber,
      remainingQuantity: remaining,
    })
  );
  return {
    writes,
    nextStatus,
    remaining,
    expectedDeliveryDate: text(order.expectedDeliveryDate),
    vendorId: text(order.vendorId),
    orderedQuantity: items.reduce((sum, item) => sum + money(item.orderedQuantity), 0),
    receivedThisTime: options.receiptItems.reduce((sum, item) => sum + money(item.quantity), 0),
  };
}

export async function listReceiptsForPurchaseOrder(purchaseOrderId: string, idToken: string) {
  return queryMasterDocuments(INVENTORY_COLLECTIONS.receipts, idToken, {
    filters: [{ field: "purchaseOrderId", value: purchaseOrderId }],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit: 50,
  });
}

export function receiptSnapshot(order: MasterRecord, items: MasterRecord[]) {
  return {
    poNumber: text(order.poNumber),
    vendorId: text(order.vendorId),
    items: items.map((item) => ({
      purchaseOrderItemId: String(item.id),
      materialId: text(item.materialId),
      description: text(item.description),
      orderedQuantity: money(item.orderedQuantity),
      receivedQuantity: money(item.receivedQuantity),
      remainingQuantity: remainingQuantity(item.orderedQuantity, item.receivedQuantity),
      uom: text(item.uom),
    })),
  };
}

export function roundLineQuantity(value: unknown) {
  return roundQuantity(value);
}
