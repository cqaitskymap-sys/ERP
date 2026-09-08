import { PROCUREMENT_COLLECTIONS } from "@/lib/procurement/collections";
import { isProcurementResource, type ProcurementResource } from "@/lib/procurement/http";
import { listByField, stripPricing, canSeeProcurementPricing } from "@/lib/procurement/helpers";
import { loadApprovals } from "@/lib/procurement/approvals";
import {
  actOnAmendment,
  actOnPurchaseOrder,
  actOnPurchaseRequisition,
  actOnVendorSelection,
  compareQuotations,
  createMaterialRequirement,
  createPurchaseOrder,
  createPurchaseOrderAmendment,
  createPurchaseRequisition,
  createRFQ,
  recordVendorQuotation,
  saveProcurementDocument,
  selectVendor,
  submitPurchaseOrder,
  submitPurchaseRequisition,
  transitionQuotation,
  transitionRFQ,
} from "@/lib/procurement/server";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";

export async function createProcurementRecord(
  resource: ProcurementResource,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  if (resource === "requirements") return createMaterialRequirement({ payload, session, idToken });
  if (resource === "requisitions") return createPurchaseRequisition({ payload, session, idToken });
  if (resource === "rfqs") return createRFQ({ payload, session, idToken });
  if (resource === "quotations") return recordVendorQuotation({ payload, session, idToken });
  if (resource === "selections") return selectVendor({ payload, session, idToken });
  if (resource === "orders") return createPurchaseOrder({ payload, session, idToken });
  if (resource === "amendments") return createPurchaseOrderAmendment({ payload, session, idToken });
  if (resource === "documents") return saveProcurementDocument({ payload, session, idToken });
  throw createNamedError("ValidationError", "This procurement resource cannot be created directly.");
}

export async function loadProcurementDetail(
  resource: ProcurementResource,
  id: string,
  idToken: string,
  session: SessionPayload
) {
  const collection = {
    requirements: PROCUREMENT_COLLECTIONS.requirements,
    requisitions: PROCUREMENT_COLLECTIONS.requisitions,
    rfqs: PROCUREMENT_COLLECTIONS.rfqs,
    quotations: PROCUREMENT_COLLECTIONS.quotations,
    selections: PROCUREMENT_COLLECTIONS.selections,
    orders: PROCUREMENT_COLLECTIONS.orders,
    amendments: PROCUREMENT_COLLECTIONS.amendments,
    documents: PROCUREMENT_COLLECTIONS.documents,
    approvals: PROCUREMENT_COLLECTIONS.approvals,
  }[resource];
  const record = await readMasterDocument(collection, id, idToken);
  if (!record) return null;
  const extra: Record<string, unknown> = {};
  if (resource === "requisitions") {
    extra.items = await listByField(PROCUREMENT_COLLECTIONS.requisitionItems, "requisitionId", id, idToken);
    extra.approvals = await loadApprovals(id, idToken);
  }
  if (resource === "rfqs") {
    extra.items = await listByField(PROCUREMENT_COLLECTIONS.rfqItems, "rfqId", id, idToken);
    extra.vendors = await listByField(PROCUREMENT_COLLECTIONS.rfqVendors, "rfqId", id, idToken);
  }
  if (resource === "quotations") {
    extra.items = await listByField(PROCUREMENT_COLLECTIONS.quotationItems, "quotationId", id, idToken);
  }
  if (resource === "orders") {
    extra.items = await listByField(PROCUREMENT_COLLECTIONS.orderItems, "purchaseOrderId", id, idToken);
    extra.approvals = await loadApprovals(id, idToken);
    extra.amendments = await listByField(PROCUREMENT_COLLECTIONS.amendments, "purchaseOrderId", id, idToken);
  }
  if (resource === "selections" || resource === "amendments") {
    extra.approvals = await loadApprovals(id, idToken);
  }
  const visible = canSeeProcurementPricing(session) ? record : stripPricing(record);
  if (!canSeeProcurementPricing(session) && Array.isArray(extra.items)) {
    extra.items = extra.items.map((item) => stripPricing(item as Record<string, unknown>));
  }
  return { record: visible, extra };
}

export async function runProcurementAction(
  resource: ProcurementResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  const comment = String(payload.comment || payload.reason || "");
  if (resource === "requisitions") {
    if (action === "submit") return submitPurchaseRequisition({ id, session, idToken, reason: comment });
    if (["approve", "reject", "return", "cancel", "review"].includes(action)) {
      return actOnPurchaseRequisition({
        id,
        action: action as "approve" | "reject" | "return" | "cancel" | "review",
        comment,
        session,
        idToken,
      });
    }
  }
  if (resource === "rfqs") {
    if (["issue", "close", "cancel", "evaluate"].includes(action)) {
      return transitionRFQ({
        id,
        action: action as "issue" | "close" | "cancel" | "evaluate",
        session,
        idToken,
        reason: comment,
      });
    }
    if (action === "compare") return compareQuotations({ rfqId: id, session, idToken });
  }
  if (resource === "quotations") {
    if (["evaluate", "cancel"].includes(action)) {
      return transitionQuotation({ id, action: action as "evaluate" | "cancel", session, idToken, reason: comment });
    }
  }
  if (resource === "selections") {
    if (["approve", "reject", "return"].includes(action)) {
      return actOnVendorSelection({
        id,
        action: action as "approve" | "reject" | "return",
        comment,
        session,
        idToken,
      });
    }
  }
  if (resource === "orders") {
    if (action === "submit") return submitPurchaseOrder({ id, session, idToken });
    if (["approve", "reject", "return", "send", "acknowledge", "cancel", "close"].includes(action)) {
      return actOnPurchaseOrder({
        id,
        action: action as "approve" | "reject" | "return" | "send" | "acknowledge" | "cancel" | "close",
        comment,
        session,
        idToken,
      });
    }
  }
  if (resource === "amendments") {
    if (["approve", "reject", "return", "cancel"].includes(action)) {
      return actOnAmendment({
        id,
        action: action as "approve" | "reject" | "return" | "cancel",
        comment,
        session,
        idToken,
      });
    }
  }
  throw createNamedError("ValidationError", "Unknown procurement action.");
}

export function assertProcurementResource(value: string): asserts value is ProcurementResource {
  if (!isProcurementResource(value)) {
    throw createNamedError("ValidationError", "Unknown procurement resource.");
  }
}
