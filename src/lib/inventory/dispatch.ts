import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import type { WarehouseResource } from "@/lib/inventory/http";
import { loadBatchDetail } from "@/lib/inventory/query";
import { listRelated } from "@/lib/inventory/query";
import {
  receiveGoodsReceipt,
  saveGoodsReceipt,
  saveStockAdjustment,
  saveStockIssue,
  saveStockReturn,
  saveStockTransfer,
  transitionQuality,
  transitionStockAdjustment,
  transitionStockIssue,
  transitionStockReturn,
  transitionStockTransfer,
  verifyGoodsReceipt,
  cancelWarehouseDocument,
} from "@/lib/inventory/server";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";

export async function createWarehouseRecord(
  resource: WarehouseResource,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  if (resource === "receipts") return saveGoodsReceipt({ payload, session, idToken });
  if (resource === "transfers") return saveStockTransfer({ payload, session, idToken });
  if (resource === "issues") return saveStockIssue({ payload, session, idToken });
  if (resource === "returns") return saveStockReturn({ payload, session, idToken });
  if (resource === "adjustments") return saveStockAdjustment({ payload, session, idToken });
  throw createNamedError("ValidationError", "This warehouse resource cannot be created directly.");
}

export async function loadWarehouseDetail(resource: WarehouseResource, id: string, idToken: string) {
  if (resource === "batches") {
    const extra = await loadBatchDetail(id, idToken);
    if (!extra) return null;
    return { record: extra.batch, extra };
  }
  const collection = {
    inventory: INVENTORY_COLLECTIONS.balances,
    batches: INVENTORY_COLLECTIONS.batches,
    receipts: INVENTORY_COLLECTIONS.receipts,
    transfers: INVENTORY_COLLECTIONS.transfers,
    issues: INVENTORY_COLLECTIONS.issues,
    returns: INVENTORY_COLLECTIONS.returns,
    adjustments: INVENTORY_COLLECTIONS.adjustments,
    ledger: INVENTORY_COLLECTIONS.ledger,
  }[resource];
  const record = await readMasterDocument(collection, id, idToken);
  if (!record) return null;
  const extra: Record<string, unknown> = {};
  if (resource === "receipts") extra.items = await listRelated(INVENTORY_COLLECTIONS.receiptItems, "receiptId", id, idToken);
  if (resource === "transfers") extra.items = await listRelated(INVENTORY_COLLECTIONS.transferItems, "transferId", id, idToken);
  if (resource === "issues") extra.items = await listRelated(INVENTORY_COLLECTIONS.issueItems, "issueId", id, idToken);
  if (resource === "returns") extra.items = await listRelated(INVENTORY_COLLECTIONS.returnItems, "returnId", id, idToken);
  return { record, extra };
}

export async function runWarehouseDocumentAction(
  resource: WarehouseResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  if (resource === "receipts") {
    if (action === "receive") return receiveGoodsReceipt({ id, session, idToken, reason: String(payload.reason || "") });
    if (action === "verify") {
      const verification =
        payload.verification && typeof payload.verification === "object"
          ? (payload.verification as Record<string, unknown>)
          : payload;
      return verifyGoodsReceipt({ id, payload: verification, session, idToken });
    }
    if (action === "cancel") {
      return cancelWarehouseDocument({
        collection: INVENTORY_COLLECTIONS.receipts,
        id,
        session,
        idToken,
        allowedFrom: ["draft"],
        permission: "goodsReceipt:create",
        reason: String(payload.reason || ""),
      });
    }
  }
  if (resource === "transfers") {
    return transitionStockTransfer({
      id,
      action: action as "request" | "approve" | "start" | "complete" | "cancel",
      session,
      idToken,
      reason: String(payload.reason || ""),
    });
  }
  if (resource === "issues") {
    return transitionStockIssue({
      id,
      action: action as "request" | "approve" | "complete" | "cancel",
      session,
      idToken,
      reason: String(payload.reason || ""),
    });
  }
  if (resource === "returns") {
    return transitionStockReturn({
      id,
      action: action as "request" | "receive" | "verify" | "complete" | "reject",
      session,
      idToken,
      reason: String(payload.reason || ""),
    });
  }
  if (resource === "adjustments") {
    return transitionStockAdjustment({
      id,
      action: action as "request" | "approve" | "cancel",
      session,
      idToken,
      reason: String(payload.reason || ""),
    });
  }
  if (resource === "inventory" && action === "quality") {
    return transitionQuality({ payload: { ...payload, balanceId: id }, session, idToken });
  }
  throw createNamedError("ValidationError", "Unknown warehouse action.");
}
