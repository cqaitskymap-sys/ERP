import { SALES_COLLECTIONS } from "@/lib/sales/collections";
import { isSalesResource, type SalesResource } from "@/lib/sales/http";
import { canSeeSalesPricing, listByField, stripPricing } from "@/lib/sales/helpers";
import { loadApprovals } from "@/lib/sales/approvals";
import {
  activatePriceList,
  allocateSalesOrderInventory,
  approveSalesOrder,
  cancelSalesOrder,
  checkOrderInventoryAvailability,
  closeSalesOrder,
  confirmSalesOrder,
  convertQuotationToSalesOrder,
  createContractManufacturingOrder,
  createCreditReview,
  createCustomerRequirement,
  createPriceList,
  createQuotation,
  createSalesCommunication,
  createSalesOrder,
  createSalesReturn,
  getSalesOrderDetailExtras,
  requestOrderChange,
  saveReceivableSnapshot,
  saveSalesDocument,
  saveSalesSettings,
  submitSalesOrderForApproval,
  transitionContractOrder,
  transitionQuotation,
  transitionRequirement,
  transitionSalesOrder,
  transitionSalesReturn,
} from "@/lib/sales/server";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";

export async function createSalesRecord(
  resource: SalesResource,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  if (resource === "priceLists") return createPriceList({ payload, session, idToken });
  if (resource === "quotations") return createQuotation({ payload, session, idToken });
  if (resource === "orders") return createSalesOrder({ payload, session, idToken });
  if (resource === "contractOrders") return createContractManufacturingOrder({ payload, session, idToken });
  if (resource === "returns") return createSalesReturn({ payload, session, idToken });
  if (resource === "requirements") return createCustomerRequirement({ payload, session, idToken });
  if (resource === "communications") return createSalesCommunication({ payload, session, idToken });
  if (resource === "creditReviews") return createCreditReview({ payload, session, idToken });
  if (resource === "receivables") return saveReceivableSnapshot({ payload, session, idToken });
  if (resource === "documents") return saveSalesDocument({ payload, session, idToken });
  if (resource === "settings") return saveSalesSettings({ payload, session, idToken });
  throw createNamedError("ValidationError", "This sales resource cannot be created directly.");
}

export async function loadSalesDetail(
  resource: SalesResource,
  id: string,
  idToken: string,
  session: SessionPayload
) {
  const collection = SALES_RESOURCES_COLLECTION[resource];
  const record = await readMasterDocument(collection, id, idToken);
  if (!record) return null;
  const extra: Record<string, unknown> = {};
  if (resource === "priceLists") {
    extra.rules = await listByField(SALES_COLLECTIONS.priceRules, "priceListId", id, idToken);
  }
  if (resource === "quotations") {
    extra.items = await listByField(SALES_COLLECTIONS.quotationItems, "quotationId", id, idToken);
    extra.approvals = await loadApprovals(id, idToken);
    extra.versions = await listByField(SALES_COLLECTIONS.quotationVersions, "quotationId", id, idToken);
  }
  if (resource === "orders") {
    Object.assign(extra, await getSalesOrderDetailExtras({ id, idToken }));
  }
  if (resource === "contractOrders") {
    extra.approvals = await loadApprovals(id, idToken);
  }
  if (resource === "returns" || resource === "creditReviews") {
    extra.approvals = await loadApprovals(id, idToken);
  }
  const visible = canSeeSalesPricing(session) ? record : stripPricing(record);
  if (!canSeeSalesPricing(session) && Array.isArray(extra.items)) {
    extra.items = (extra.items as Array<Record<string, unknown>>).map((item) => stripPricing(item));
  }
  if (!canSeeSalesPricing(session) && Array.isArray(extra.rules)) {
    extra.rules = (extra.rules as Array<Record<string, unknown>>).map((item) => stripPricing(item));
  }
  return { record: visible, extra };
}

const SALES_RESOURCES_COLLECTION: Record<SalesResource, string> = {
  priceLists: SALES_COLLECTIONS.priceLists,
  priceRules: SALES_COLLECTIONS.priceRules,
  quotations: SALES_COLLECTIONS.quotations,
  orders: SALES_COLLECTIONS.orders,
  contractOrders: SALES_COLLECTIONS.contractOrders,
  returns: SALES_COLLECTIONS.returns,
  requirements: SALES_COLLECTIONS.requirements,
  communications: SALES_COLLECTIONS.communications,
  creditReviews: SALES_COLLECTIONS.creditReviews,
  documents: SALES_COLLECTIONS.documents,
  approvals: SALES_COLLECTIONS.orderApprovals,
  receivables: SALES_COLLECTIONS.receivables,
  settings: SALES_COLLECTIONS.settings,
};

export async function runSalesAction(
  resource: SalesResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  const comment = String(payload.comment || payload.reason || "");
  if (resource === "priceLists") {
    if (action === "activate") return activatePriceList({ id, session, idToken, reason: comment });
  }
  if (resource === "quotations") {
    if (
      [
        "submit_review",
        "submit_approval",
        "approve",
        "reject",
        "mark_sent",
        "negotiate",
        "accept",
        "expire",
        "cancel",
      ].includes(action)
    ) {
      return transitionQuotation({
        id,
        action: action as
          | "submit_review"
          | "submit_approval"
          | "approve"
          | "reject"
          | "mark_sent"
          | "negotiate"
          | "accept"
          | "expire"
          | "cancel",
        comment,
        session,
        idToken,
      });
    }
    if (action === "convert") {
      return convertQuotationToSalesOrder({ id, session, idToken, payload });
    }
  }
  if (resource === "orders") {
    if (action === "submit") return submitSalesOrderForApproval({ id, session, idToken, reason: comment });
    if (["approve", "reject", "return"].includes(action)) {
      return approveSalesOrder({
        id,
        action: action as "approve" | "reject" | "return",
        comment,
        session,
        idToken,
      });
    }
    if (action === "confirm") return confirmSalesOrder({ id, session, idToken, reason: comment });
    if (action === "cancel") return cancelSalesOrder({ id, reason: comment || "Cancelled", session, idToken });
    if (action === "close") return closeSalesOrder({ id, session, idToken, reason: comment });
    if (action === "allocate") {
      return allocateSalesOrderInventory({
        id,
        session,
        idToken,
        warehouseId: String(payload.warehouseId || ""),
        lineId: String(payload.lineId || ""),
        quantity: payload.quantity != null ? Number(payload.quantity) : undefined,
      });
    }
    if (action === "availability") {
      return checkOrderInventoryAvailability({
        id,
        warehouseId: String(payload.warehouseId || ""),
        idToken,
      });
    }
    if (action === "change") return requestOrderChange({ id, payload, session, idToken });
    if (action === "transition" && payload.toStatus) {
      return transitionSalesOrder({
        id,
        toStatus: String(payload.toStatus),
        reason: comment,
        session,
        idToken,
      });
    }
  }
  if (resource === "contractOrders") {
    if (["submit", "approve", "reject", "confirm_commercial", "link_production", "cancel"].includes(action)) {
      return transitionContractOrder({
        id,
        action: action as "submit" | "approve" | "reject" | "confirm_commercial" | "link_production" | "cancel",
        comment,
        productionPlanId: String(payload.productionPlanId || ""),
        session,
        idToken,
      });
    }
  }
  if (resource === "returns") {
    if (action === "transition" && payload.toStatus) {
      return transitionSalesReturn({
        id,
        toStatus: String(payload.toStatus),
        resolution: String(payload.resolution || ""),
        comment,
        session,
        idToken,
      });
    }
  }
  if (resource === "requirements") {
    if (action === "transition" && payload.toStatus) {
      return transitionRequirement({
        id,
        toStatus: String(payload.toStatus),
        reason: comment,
        session,
        idToken,
      });
    }
  }
  if (!isSalesResource(resource)) {
    throw createNamedError("ValidationError", "Unknown sales resource.");
  }
  throw createNamedError("ValidationError", `Unsupported action "${action}" for ${resource}.`);
}
