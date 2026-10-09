import { SALES_COLLECTIONS } from "@/lib/sales/collections";
import { loadApprovals } from "@/lib/sales/approvals";
import { agingBuckets, loadCustomerReceivableSnapshot } from "@/lib/sales/credit";
import { canSeeSalesPricing, listByField, stripPricing, text } from "@/lib/sales/helpers";
import { money } from "@/lib/sales/money";
import { isOpenOrderStatus } from "@/lib/sales/status";
import {
  queryMasterDocuments,
  readMasterDocument,
  type MasterQueryFilter,
  type MasterRecord,
} from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";
import type { SalesReportType } from "@/types/sales";

const SEARCH_END = "\uf8ff";

export interface SalesListQuery {
  status?: string;
  customerId?: string;
  productId?: string;
  salesRepresentative?: string;
  orderType?: string;
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
  if (canSeeSalesPricing(session)) return rows;
  return rows.map((row) => stripPricing(row));
}

export async function listSalesRecords(
  collection: string,
  query: SalesListQuery,
  idToken: string,
  session: SessionPayload
) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.customerId) filters.push({ field: "customerId", value: query.customerId });
  if (query.productId) filters.push({ field: "productId", value: query.productId });
  if (query.salesRepresentative) filters.push({ field: "salesRepresentative", value: query.salesRepresentative });
  if (query.orderType) filters.push({ field: "orderType", value: query.orderType });
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
  let filtered = rows;
  if (query.from || query.to) {
    filtered = rows.filter((row) => {
      const date = text(row.orderDate || row.quotationDate || row.createdAt).slice(0, 10);
      if (query.from && date < query.from) return false;
      if (query.to && date > query.to) return false;
      return true;
    });
  }
  return paginate(maybeStrip(filtered, session), pageSize, (row) => [String(row.updatedAt || "")]);
}

export async function loadSalesDashboard(idToken: string, query: SalesListQuery = {}) {
  const [orders, quotations, approvals, returns, cmos] = await Promise.all([
    queryMasterDocuments(SALES_COLLECTIONS.orders, idToken, { limit: 400 }),
    queryMasterDocuments(SALES_COLLECTIONS.quotations, idToken, { limit: 200 }),
    queryMasterDocuments(SALES_COLLECTIONS.orderApprovals, idToken, {
      filters: [{ field: "status", value: "pending" }],
      limit: 200,
    }),
    queryMasterDocuments(SALES_COLLECTIONS.returns, idToken, { limit: 100 }),
    queryMasterDocuments(SALES_COLLECTIONS.contractOrders, idToken, { limit: 100 }),
  ]);

  const filteredOrders = orders.filter((row) => {
    if (query.customerId && text(row.customerId) !== query.customerId) return false;
    if (query.salesRepresentative && text(row.salesRepresentative) !== query.salesRepresentative) return false;
    if (query.status && query.status !== "all" && text(row.status) !== query.status) return false;
    const date = text(row.orderDate || row.createdAt).slice(0, 10);
    if (query.from && date < query.from) return false;
    if (query.to && date > query.to) return false;
    return true;
  });

  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);
  const byStatus: Record<string, number> = {};
  const byCustomer: Record<string, number> = {};
  const byProduct: Record<string, number> = {};
  const monthly: Record<string, number> = {};
  let monthlySalesValue = 0;
  let fulfilmentSum = 0;
  let fulfilmentCount = 0;
  let outstandingBalances = 0;

  for (const order of filteredOrders) {
    const status = text(order.status) || "unknown";
    byStatus[status] = (byStatus[status] || 0) + 1;
    if (!["cancelled", "draft"].includes(status)) {
      const value = money(order.grandTotal);
      byCustomer[text(order.customerId) || "unknown"] = money(
        (byCustomer[text(order.customerId) || "unknown"] || 0) + value
      );
      const month = text(order.orderDate).slice(0, 7) || "unknown";
      monthly[month] = money((monthly[month] || 0) + value);
      if (month === monthPrefix) monthlySalesValue = money(monthlySalesValue + value);
      fulfilmentSum += Number(order.fulfilmentPercent || 0);
      fulfilmentCount += 1;
    }
  }

  const orderItems = await queryMasterDocuments(SALES_COLLECTIONS.orderItems, idToken, { limit: 500 });
  for (const item of orderItems) {
    if (query.productId && text(item.productId) !== query.productId) continue;
    const key = text(item.productId) || "unknown";
    byProduct[key] = money((byProduct[key] || 0) + money(item.lineTotal || item.quantity));
  }

  const delayed = filteredOrders.filter(
    (row) =>
      text(row.promisedDeliveryDate) &&
      text(row.promisedDeliveryDate) < today &&
      isOpenOrderStatus(text(row.status)) &&
      money(row.remainingQuantity) > 0
  );

  const customerIds = [...new Set(filteredOrders.map((row) => text(row.customerId)).filter(Boolean))].slice(0, 40);
  for (const customerId of customerIds) {
    const snap = await loadCustomerReceivableSnapshot(customerId, idToken);
    if (snap) outstandingBalances = money(outstandingBalances + money(snap.outstandingBalance));
  }

  const blocked = filteredOrders.filter((row) => {
    const flags = (row.riskFlags || {}) as Record<string, unknown>;
    return Boolean(flags.creditBlocked || row.regulatoryHold || row.documentationHold);
  });

  const topCustomers = Object.entries(byCustomer)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));
  const bestProducts = Object.entries(byProduct)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  return {
    kpis: {
      totalOrders: filteredOrders.length,
      draftOrders: filteredOrders.filter((row) => text(row.status) === "draft").length,
      pendingApproval: filteredOrders.filter((row) => text(row.status) === "pending_approval").length,
      confirmed: filteredOrders.filter((row) => text(row.status) === "confirmed").length,
      inProduction: filteredOrders.filter((row) => text(row.status) === "in_production").length,
      awaitingQaRelease: filteredOrders.filter((row) => text(row.status) === "awaiting_qa_release").length,
      readyForDispatch: filteredOrders.filter((row) => text(row.status) === "ready_for_dispatch").length,
      partiallyFulfilled: filteredOrders.filter((row) => text(row.status) === "partially_fulfilled").length,
      delivered: filteredOrders.filter((row) => text(row.status) === "delivered").length,
      cancelled: filteredOrders.filter((row) => text(row.status) === "cancelled").length,
      outstandingBalances,
      monthlySalesValue,
      fulfilmentPercent: fulfilmentCount ? money(fulfilmentSum / fulfilmentCount) : 0,
      delayedOrders: delayed.length,
      pendingCommercialApprovals: approvals.filter((row) => text(row.documentType) === "salesOrder").length,
      blockedOrders: blocked.length,
      openQuotations: quotations.filter((row) =>
        ["draft", "internal_review", "pending_approval", "sent", "negotiation"].includes(text(row.status))
      ).length,
      openReturns: returns.filter((row) => !["closed", "rejected", "cancelled"].includes(text(row.status))).length,
      openCmos: cmos.filter((row) => !["closed", "cancelled", "fulfilled"].includes(text(row.status))).length,
    },
    charts: {
      byStatus,
      monthly,
      topCustomers: Object.fromEntries(topCustomers.map((row) => [row.name, row.value])),
      bestProducts: Object.fromEntries(bestProducts.map((row) => [row.name, row.value])),
      quotationPipeline: quotations.reduce<Record<string, number>>((acc, row) => {
        const status = text(row.status) || "unknown";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}

export async function loadCustomer360(customerId: string, idToken: string, session: SessionPayload) {
  const customer = await readMasterDocument("customers", customerId, idToken);
  if (!customer) return null;
  const [
    contacts,
    quotations,
    orders,
    requirements,
    communications,
    returns,
    documents,
    contracts,
    creditReviews,
    receivable,
  ] = await Promise.all([
    queryMasterDocuments("customerContacts", idToken, {
      filters: [{ field: "customerId", value: customerId }],
      limit: 50,
    }).catch(() => []),
    listByField(SALES_COLLECTIONS.quotations, "customerId", customerId, idToken),
    listByField(SALES_COLLECTIONS.orders, "customerId", customerId, idToken),
    listByField(SALES_COLLECTIONS.requirements, "customerId", customerId, idToken),
    listByField(SALES_COLLECTIONS.communications, "customerId", customerId, idToken),
    listByField(SALES_COLLECTIONS.returns, "customerId", customerId, idToken),
    queryMasterDocuments("customerDocuments", idToken, {
      filters: [{ field: "customerId", value: customerId }],
      limit: 50,
    }).catch(() => []),
    queryMasterDocuments("customerContracts", idToken, {
      filters: [{ field: "customerId", value: customerId }],
      limit: 50,
    }).catch(() => []),
    listByField(SALES_COLLECTIONS.creditReviews, "customerId", customerId, idToken),
    loadCustomerReceivableSnapshot(customerId, idToken),
  ]);

  const shipments = await queryMasterDocuments("warehouseShipments", idToken, {
    filters: [{ field: "customerId", value: customerId }],
    limit: 50,
  }).catch(() => []);

  const complaints = await queryMasterDocuments("complaintCases", idToken, {
    filters: [{ field: "customerId", value: customerId }],
    limit: 30,
  }).catch(() => []);

  const visibleCustomer = canSeeSalesPricing(session) ? customer : stripPricing(customer);
  const balance = receivable
    ? {
        creditLimit: money(receivable.creditLimit),
        outstandingBalance: money(receivable.outstandingBalance),
        overdueBalance: money(receivable.overdueBalance),
        aging: agingBuckets(money(receivable.overdueBalance), money(receivable.outstandingBalance)),
        source: receivable.source,
      }
    : {
        creditLimit: money(customer.creditLimit),
        outstandingBalance: money(customer.outstandingBalance),
        overdueBalance: money(customer.overdueBalance),
        aging: agingBuckets(money(customer.overdueBalance), money(customer.outstandingBalance)),
        source: "customer",
      };

  return {
    customer: visibleCustomer,
    contacts,
    quotations: maybeStrip(quotations, session),
    orders: maybeStrip(orders, session),
    fulfilmentHistory: orders.map((order) => ({
      id: order.id,
      salesOrderNumber: order.salesOrderNumber,
      status: order.status,
      fulfilmentPercent: order.fulfilmentPercent,
      promisedDeliveryDate: order.promisedDeliveryDate,
    })),
    dispatches: shipments,
    outstandingBalances: canSeeSalesPricing(session) ? balance : { note: "Restricted by RBAC" },
    requirements,
    contracts,
    documents,
    communications,
    complaints,
    returns,
    creditReviews: canSeeSalesPricing(session) ? creditReviews : creditReviews.map((row) => stripPricing(row)),
  };
}

export async function loadPendingSalesApprovals(idToken: string) {
  const rows = await queryMasterDocuments(SALES_COLLECTIONS.orderApprovals, idToken, {
    filters: [{ field: "status", value: "pending" }],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit: 100,
  });
  return { rows };
}

export async function loadSalesReport(
  type: SalesReportType,
  query: SalesListQuery,
  idToken: string,
  session: SessionPayload
) {
  const orders = await queryMasterDocuments(SALES_COLLECTIONS.orders, idToken, { limit: 500 });
  const quotations = await queryMasterDocuments(SALES_COLLECTIONS.quotations, idToken, { limit: 300 });
  const returns = await queryMasterDocuments(SALES_COLLECTIONS.returns, idToken, { limit: 200 });
  const cmos = await queryMasterDocuments(SALES_COLLECTIONS.contractOrders, idToken, { limit: 200 });
  const today = new Date().toISOString().slice(0, 10);

  const inRange = (row: MasterRecord, dateField = "orderDate") => {
    const date = text(row[dateField] || row.createdAt).slice(0, 10);
    if (query.from && date < query.from) return false;
    if (query.to && date > query.to) return false;
    if (query.customerId && text(row.customerId) !== query.customerId) return false;
    if (query.salesRepresentative && text(row.salesRepresentative) !== query.salesRepresentative) return false;
    return true;
  };

  let rows: MasterRecord[] = [];
  let grouped: Record<string, number> | undefined;

  switch (type) {
    case "sales_order_register":
      rows = orders.filter((row) => inRange(row));
      break;
    case "customer_sales": {
      grouped = {};
      for (const order of orders.filter((row) => inRange(row) && !["cancelled", "draft"].includes(text(row.status)))) {
        const key = text(order.customerId) || "unknown";
        grouped[key] = money((grouped[key] || 0) + money(order.grandTotal));
      }
      rows = Object.entries(grouped).map(([customerId, value]) => ({ id: customerId, customerId, value }));
      break;
    }
    case "product_sales": {
      const items = await queryMasterDocuments(SALES_COLLECTIONS.orderItems, idToken, { limit: 800 });
      grouped = {};
      for (const item of items) {
        if (query.productId && text(item.productId) !== query.productId) continue;
        const key = text(item.productId) || "unknown";
        grouped[key] = money((grouped[key] || 0) + money(item.lineTotal));
      }
      rows = Object.entries(grouped).map(([productId, value]) => ({ id: productId, productId, value }));
      break;
    }
    case "monthly_sales":
    case "yearly_sales": {
      grouped = {};
      for (const order of orders.filter((row) => inRange(row) && !["cancelled", "draft"].includes(text(row.status)))) {
        const key =
          type === "yearly_sales"
            ? text(order.orderDate).slice(0, 4) || "unknown"
            : text(order.orderDate).slice(0, 7) || "unknown";
        grouped[key] = money((grouped[key] || 0) + money(order.grandTotal));
      }
      rows = Object.entries(grouped).map(([period, value]) => ({ id: period, period, value }));
      break;
    }
    case "order_fulfilment":
      rows = orders.filter((row) => inRange(row)).map((row) => ({
        ...row,
        fulfilmentPercent: Number(row.fulfilmentPercent || 0),
        remainingQuantity: money(row.remainingQuantity),
      }));
      break;
    case "delayed_orders":
      rows = orders.filter(
        (row) =>
          inRange(row) &&
          text(row.promisedDeliveryDate) &&
          text(row.promisedDeliveryDate) < today &&
          isOpenOrderStatus(text(row.status))
      );
      break;
    case "pending_approvals": {
      const approvals = await loadPendingSalesApprovals(idToken);
      rows = approvals.rows;
      break;
    }
    case "open_orders":
      rows = orders.filter((row) => inRange(row) && isOpenOrderStatus(text(row.status)));
      break;
    case "cancelled_orders":
      rows = orders.filter((row) => inRange(row) && text(row.status) === "cancelled");
      break;
    case "partial_fulfilment":
      rows = orders.filter((row) => inRange(row) && text(row.status) === "partially_fulfilled");
      break;
    case "sales_rep_performance": {
      grouped = {};
      for (const order of orders.filter((row) => inRange(row) && !["cancelled", "draft"].includes(text(row.status)))) {
        const key = text(order.salesRepresentative) || "unassigned";
        grouped[key] = money((grouped[key] || 0) + money(order.grandTotal));
      }
      rows = Object.entries(grouped).map(([salesRepresentative, value]) => ({
        id: salesRepresentative,
        salesRepresentative,
        value,
      }));
      break;
    }
    case "quotation_conversion": {
      const accepted = quotations.filter((row) => inRange(row, "quotationDate") && ["accepted", "converted"].includes(text(row.status)));
      const total = quotations.filter((row) => inRange(row, "quotationDate"));
      const rate = total.length ? money((accepted.length / total.length) * 100) : 0;
      rows = [
        {
          id: "conversion",
          totalQuotations: total.length,
          acceptedOrConverted: accepted.length,
          conversionRatePercent: rate,
        },
      ];
      break;
    }
    case "customer_balances": {
      const customerIds = [...new Set(orders.map((row) => text(row.customerId)).filter(Boolean))].slice(0, 100);
      rows = [];
      for (const customerId of customerIds) {
        if (query.customerId && customerId !== query.customerId) continue;
        const snap = await loadCustomerReceivableSnapshot(customerId, idToken);
        const customer = await readMasterDocument("customers", customerId, idToken);
        rows.push({
          id: customerId,
          customerId,
          creditLimit: money(snap?.creditLimit ?? customer?.creditLimit),
          outstandingBalance: money(snap?.outstandingBalance ?? customer?.outstandingBalance),
          overdueBalance: money(snap?.overdueBalance ?? customer?.overdueBalance),
          source: snap ? "receivable_snapshot" : "customer",
        });
      }
      break;
    }
    case "returns":
      rows = returns.filter((row) => inRange(row, "createdAt"));
      break;
    case "cmo_status":
      rows = cmos.filter((row) => inRange(row, "createdAt"));
      break;
    default:
      rows = orders.filter((row) => inRange(row));
  }

  return {
    rows: maybeStrip(rows, session),
    nextCursor: null,
    grouped,
  };
}

export async function loadOrderApprovalsForDocument(documentId: string, idToken: string) {
  return loadApprovals(documentId, idToken);
}
