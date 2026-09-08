import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import { PROCUREMENT_COLLECTIONS } from "@/lib/procurement/collections";
import { loadApprovals } from "@/lib/procurement/approvals";
import { canSeeProcurementPricing, listByField, stripPricing, text } from "@/lib/procurement/helpers";
import { money } from "@/lib/procurement/money";
import { calculateRemainingPOQuantity, remainingQuantity } from "@/lib/procurement/receipts";
import {
  queryMasterDocuments,
  readMasterDocument,
  type MasterQueryFilter,
  type MasterRecord,
} from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";
import type { AppRole } from "@/types/permissions";
import type { ProcurementReportType } from "@/types/procurement";

const SEARCH_END = "\uf8ff";

export interface ProcurementListQuery {
  status?: string;
  vendorId?: string;
  materialId?: string;
  departmentId?: string;
  plantId?: string;
  requester?: string;
  requisitionId?: string;
  rfqId?: string;
  purchaseOrderId?: string;
  approvalStatus?: string;
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

function maybeStrip(rows: MasterRecord[], session: SessionPayload) {
  if (canSeeProcurementPricing(session)) return rows;
  return rows.map((row) => stripPricing(row));
}

export async function listProcurementRecords(
  collection: string,
  query: ProcurementListQuery,
  idToken: string,
  session: SessionPayload
) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.vendorId) filters.push({ field: "vendorId", value: query.vendorId });
  if (query.departmentId) filters.push({ field: "departmentId", value: query.departmentId });
  if (query.plantId) filters.push({ field: "plantId", value: query.plantId });
  if (query.requester) filters.push({ field: "requestedBy", value: query.requester });
  if (query.requisitionId) filters.push({ field: "requisitionId", value: query.requisitionId });
  if (query.rfqId) filters.push({ field: "rfqId", value: query.rfqId });
  if (query.purchaseOrderId) filters.push({ field: "purchaseOrderId", value: query.purchaseOrderId });
  if (query.approvalStatus) filters.push({ field: "approvalStatus", value: query.approvalStatus });

  const search = query.search?.trim().toLowerCase();
  const cursorValues = decodeCursor(query.cursor);
  if (search) {
    const rows = await queryMasterDocuments(collection, idToken, {
      filters: [
        ...filters,
        { field: "searchIndex", op: "GREATER_THAN_OR_EQUAL", value: search },
        { field: "searchIndex", op: "LESS_THAN", value: `${search}${SEARCH_END}` },
      ],
      orderBy: [{ field: "searchIndex" }],
      startAfter: cursorValues,
      limit: pageSize + 1,
    });
    return paginate(maybeStrip(rows, session), pageSize, (row) => [String(row.searchIndex || "")]);
  }

  const rows = await queryMasterDocuments(collection, idToken, {
    filters,
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    startAfter: cursorValues,
    limit: pageSize + 1,
  });
  return paginate(maybeStrip(rows, session), pageSize, (row) => [String(row.updatedAt || "")]);
}

export async function loadProcurementDashboard(idToken: string) {
  const [prs, rfqs, quotations, orders, approvals] = await Promise.all([
    queryMasterDocuments(PROCUREMENT_COLLECTIONS.requisitions, idToken, { limit: 300 }),
    queryMasterDocuments(PROCUREMENT_COLLECTIONS.rfqs, idToken, { limit: 200 }),
    queryMasterDocuments(PROCUREMENT_COLLECTIONS.quotations, idToken, { limit: 200 }),
    queryMasterDocuments(PROCUREMENT_COLLECTIONS.orders, idToken, { limit: 300 }),
    queryMasterDocuments(PROCUREMENT_COLLECTIONS.approvals, idToken, {
      filters: [{ field: "status", value: "pending" }],
      limit: 200,
    }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const openPrs = prs.filter((row) => !["completed", "cancelled", "rejected"].includes(text(row.status)));
  const openPos = orders.filter((row) =>
    ["approved", "sent", "acknowledged", "partially_received"].includes(text(row.status))
  );
  const overdue = orders.filter(
    (row) =>
      text(row.expectedDeliveryDate) &&
      text(row.expectedDeliveryDate) < today &&
      Number(row.remainingQuantity || 0) > 0 &&
      !["cancelled", "closed", "draft"].includes(text(row.status))
  );
  const byVendor: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const monthly: Record<string, number> = {};
  for (const order of orders) {
    if (["cancelled", "draft"].includes(text(order.status))) continue;
    const value = money(order.grandTotal);
    byVendor[text(order.vendorId) || "unknown"] = money((byVendor[text(order.vendorId) || "unknown"] || 0) + value);
    byStatus[text(order.status)] = (byStatus[text(order.status)] || 0) + 1;
    const month = text(order.poDate).slice(0, 7) || "unknown";
    monthly[month] = money((monthly[month] || 0) + value);
  }
  const onTime = orders.filter((row) => text(row.status) === "fully_received" || text(row.status) === "closed");
  return {
    kpis: {
      openPrs: openPrs.length,
      pendingApprovals: approvals.length,
      activeRfqs: rfqs.filter((row) => ["issued", "partially_responded", "fully_responded", "evaluation"].includes(text(row.status))).length,
      quotationsPending: quotations.filter((row) => ["received", "under_evaluation"].includes(text(row.status))).length,
      posPendingApproval: orders.filter((row) => text(row.status) === "under_approval").length,
      openPos: openPos.length,
      partiallyReceived: orders.filter((row) => text(row.status) === "partially_received").length,
      overdueDeliveries: overdue.length,
      completedPos: orders.filter((row) => ["fully_received", "closed"].includes(text(row.status))).length,
    },
    charts: {
      byVendor,
      byStatus,
      monthly,
      deliveryPerformance: {
        completed: onTime.length,
        overdue: overdue.length,
        open: openPos.length,
      },
    },
  };
}

export async function loadPurchaseTracking(id: string, idToken: string) {
  const order = await readMasterDocument(PROCUREMENT_COLLECTIONS.orders, id, idToken);
  if (!order) return null;
  const [pr, rfq, quotation, selection, items, receipts, approvals] = await Promise.all([
    order.requisitionId ? readMasterDocument(PROCUREMENT_COLLECTIONS.requisitions, text(order.requisitionId), idToken) : null,
    order.rfqId ? readMasterDocument(PROCUREMENT_COLLECTIONS.rfqs, text(order.rfqId), idToken) : null,
    order.quotationId ? readMasterDocument(PROCUREMENT_COLLECTIONS.quotations, text(order.quotationId), idToken) : null,
    order.selectionId ? readMasterDocument(PROCUREMENT_COLLECTIONS.selections, text(order.selectionId), idToken) : null,
    listByField(PROCUREMENT_COLLECTIONS.orderItems, "purchaseOrderId", id, idToken),
    queryMasterDocuments(INVENTORY_COLLECTIONS.receipts, idToken, {
      filters: [{ field: "purchaseOrderId", value: id }],
      limit: 20,
    }),
    loadApprovals(id, idToken),
  ]);
  const stages = [
    { id: "pr_created", label: "PR Created", at: pr?.createdAt, status: pr ? "done" : "pending" },
    { id: "pr_approved", label: "PR Approved", at: pr?.updatedAt, status: pr && text(pr.status) !== "draft" && text(pr.approvalStatus) === "approved" ? "done" : pr ? "pending" : "unavailable" },
    { id: "rfq_created", label: "RFQ Created", at: rfq?.createdAt, status: rfq ? "done" : "unavailable" },
    { id: "quotation_received", label: "Quotation Received", at: quotation?.createdAt, status: quotation ? "done" : "unavailable" },
    { id: "vendor_selected", label: "Vendor Selected", at: selection?.selectedAt, status: selection ? "done" : "unavailable" },
    { id: "po_created", label: "PO Created", at: order.createdAt, status: "done" },
    { id: "po_approved", label: "PO Approved", at: order.updatedAt, status: ["approved", "sent", "acknowledged", "partially_received", "fully_received", "closed"].includes(text(order.status)) ? "done" : "pending" },
    { id: "po_sent", label: "PO Sent", at: text(order.status) === "sent" || ["acknowledged", "partially_received", "fully_received", "closed"].includes(text(order.status)) ? order.updatedAt : "", status: ["sent", "acknowledged", "partially_received", "fully_received", "closed"].includes(text(order.status)) ? "done" : "pending" },
    { id: "delivery", label: "Delivery", at: order.expectedDeliveryDate, status: receipts.length ? "done" : "pending" },
    { id: "goods_receipt", label: "Goods Receipt", at: receipts[0]?.receiptDate, status: receipts.length ? "done" : "pending" },
    { id: "qc", label: "QC", at: "", status: "unavailable", note: "Pending / Not Yet Available" },
    { id: "qa", label: "QA", at: "", status: "unavailable", note: "Pending / Not Yet Available" },
    { id: "inventory", label: "Inventory", at: "", status: receipts.length ? "pending" : "unavailable", note: receipts.length ? "Received into quarantine. QA release is a later step." : "Pending / Not Yet Available" },
  ];
  return { record: order, items, receipts, approvals, pr, rfq, quotation, selection, stages };
}

export async function loadOverduePurchaseOrders(idToken: string, session: SessionPayload) {
  const today = new Date().toISOString().slice(0, 10);
  const orders = await queryMasterDocuments(PROCUREMENT_COLLECTIONS.orders, idToken, { limit: 300 });
  const rows = [];
  for (const order of orders) {
    if (!text(order.expectedDeliveryDate) || text(order.expectedDeliveryDate) >= today) continue;
    if (["cancelled", "closed", "draft", "fully_received"].includes(text(order.status))) continue;
    const items = await listByField(PROCUREMENT_COLLECTIONS.orderItems, "purchaseOrderId", String(order.id), idToken);
    const remaining = calculateRemainingPOQuantity(items);
    if (remaining <= 0) continue;
    const daysOverdue = Math.floor(
      (new Date(today).getTime() - new Date(text(order.expectedDeliveryDate)).getTime()) / 86400000
    );
    rows.push({
      ...(!canSeeProcurementPricing(session) ? stripPricing(order) : order),
      items: items.map((item) => ({
        materialId: item.materialId,
        orderedQuantity: item.orderedQuantity,
        receivedQuantity: item.receivedQuantity,
        remainingQuantity: remainingQuantity(item.orderedQuantity, item.receivedQuantity),
      })),
      remainingQuantity: remaining,
      daysOverdue,
    });
  }
  return { rows };
}

export async function loadQuotationComparison(rfqId: string, idToken: string, session: SessionPayload) {
  const rfq = await readMasterDocument(PROCUREMENT_COLLECTIONS.rfqs, rfqId, idToken);
  if (!rfq) return null;
  const [quotations, items, vendors, rfqItems] = await Promise.all([
    listByField(PROCUREMENT_COLLECTIONS.quotations, "rfqId", rfqId, idToken),
    queryMasterDocuments(PROCUREMENT_COLLECTIONS.quotationItems, idToken, {
      filters: [{ field: "rfqId", value: rfqId }],
      limit: 200,
    }),
    listByField(PROCUREMENT_COLLECTIONS.rfqVendors, "rfqId", rfqId, idToken),
    listByField(PROCUREMENT_COLLECTIONS.rfqItems, "rfqId", rfqId, idToken),
  ]);
  const vendorRecords = await Promise.all(
    vendors.map(async (row) => ({
      vendorId: text(row.vendorId),
      vendor: await readMasterDocument("vendors", text(row.vendorId), idToken),
    }))
  );
  const usable = quotations.filter((row) => !["cancelled"].includes(text(row.status)));
  const highlights = usable.length
    ? {
        lowestPrice: usable.reduce((best, row) => (money(row.grandTotal) < money(best.grandTotal) ? row : best)).id,
        shortestLead: usable.reduce((best, row) =>
          Number(row.leadTime || 9999) < Number(best.leadTime || 9999) ? row : best
        ).id,
        bestQualification: vendorRecords.find((row) => text(row.vendor?.qualificationStatus) === "qualified")?.vendorId || "",
      }
    : {};
  const showPrice = canSeeProcurementPricing(session);
  return {
    rfq,
    rfqItems,
    quotations: showPrice ? usable : usable.map((row) => stripPricing(row)),
    items: showPrice ? items : items.map((row) => stripPricing(row)),
    vendors: vendorRecords,
    highlights,
    autoSelected: false,
  };
}

export async function loadPendingApprovals(idToken: string, session: SessionPayload) {
  const rows = await queryMasterDocuments(PROCUREMENT_COLLECTIONS.approvals, idToken, {
    filters: [{ field: "status", value: "pending" }],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit: 100,
  });
  const mine = rows.filter(
    (row) =>
      session.roles.includes(text(row.role) as AppRole) ||
      session.roles.includes("admin") ||
      session.roles.includes("super_admin")
  );
  return { rows: mine };
}

export async function loadProcurementReport(
  type: ProcurementReportType,
  query: ProcurementListQuery,
  idToken: string,
  session: SessionPayload
) {
  const collection =
    type === "purchase_requisition"
      ? PROCUREMENT_COLLECTIONS.requisitions
      : type === "rfq"
        ? PROCUREMENT_COLLECTIONS.rfqs
        : type === "vendor_quotation" || type === "quotation_comparison"
          ? PROCUREMENT_COLLECTIONS.quotations
          : PROCUREMENT_COLLECTIONS.orders;
  if (type === "overdue_po") return loadOverduePurchaseOrders(idToken, session);
  if (type === "open_po") {
    return listProcurementRecords(
      collection,
      { ...query, status: query.status || "approved", pageSize: query.pageSize || 50 },
      idToken,
      session
    );
  }
  const listed = await listProcurementRecords(collection, { ...query, pageSize: query.pageSize || 50 }, idToken, session);
  if (type === "monthly_purchase" || type === "purchase_value" || type === "vendor_purchase" || type === "material_purchase") {
    const grouped: Record<string, number> = {};
    for (const row of listed.rows) {
      const key =
        type === "monthly_purchase"
          ? text(row.poDate).slice(0, 7) || "unknown"
          : type === "vendor_purchase"
            ? text(row.vendorId) || "unknown"
            : type === "material_purchase"
              ? "see-lines"
              : "total";
      grouped[key] = money((grouped[key] || 0) + money(row.grandTotal));
    }
    return { ...listed, grouped };
  }
  if (type === "delivery_performance") {
    const today = new Date().toISOString().slice(0, 10);
    const rows = listed.rows.map((row) => ({
      ...row,
      overdue: text(row.expectedDeliveryDate) < today && Number(row.remainingQuantity || 0) > 0,
    }));
    return { rows, nextCursor: listed.nextCursor };
  }
  return listed;
}
