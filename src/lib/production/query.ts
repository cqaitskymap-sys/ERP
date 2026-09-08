import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";
import { listByField, text } from "@/lib/production/helpers";
import { loadApprovals } from "@/lib/production/approvals";
import { queryMasterDocuments, readMasterDocument, type MasterQueryFilter, type MasterRecord } from "@/lib/masters/firestore";
import { PRODUCTION_REPORT_TYPES } from "@/types/production";

type ProductionReportType = (typeof PRODUCTION_REPORT_TYPES)[number];

const SEARCH_END = "\uf8ff";

export interface ProductionListQuery {
  status?: string;
  productId?: string;
  customerId?: string;
  plantId?: string;
  workCenterId?: string;
  batchNumber?: string;
  manufacturingOrderId?: string;
  search?: string;
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
  return { rows: page, nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null };
}

export async function listProductionRecords(collection: string, query: ProductionListQuery, idToken: string) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.productId) filters.push({ field: "productId", value: query.productId });
  if (query.customerId) filters.push({ field: "customerId", value: query.customerId });
  if (query.plantId) filters.push({ field: "plantId", value: query.plantId });
  if (query.workCenterId) filters.push({ field: "workCenterId", value: query.workCenterId });
  if (query.batchNumber) filters.push({ field: "batchNumber", value: query.batchNumber });
  if (query.manufacturingOrderId) filters.push({ field: "manufacturingOrderId", value: query.manufacturingOrderId });
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
    return paginate(rows, pageSize, (row) => [String(row.searchIndex || "")]);
  }
  const rows = await queryMasterDocuments(collection, idToken, {
    filters,
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    startAfter: cursorValues,
    limit: pageSize + 1,
  });
  return paginate(rows, pageSize, (row) => [String(row.updatedAt || "")]);
}

export async function loadProductionDashboard(idToken: string) {
  const [plans, schedules, orders, shortages, yields] = await Promise.all([
    queryMasterDocuments(PRODUCTION_COLLECTIONS.plans, idToken, { limit: 200 }),
    queryMasterDocuments(PRODUCTION_COLLECTIONS.schedules, idToken, { limit: 200 }),
    queryMasterDocuments(PRODUCTION_COLLECTIONS.orders, idToken, { limit: 300 }),
    queryMasterDocuments(PRODUCTION_COLLECTIONS.dispensingItems, idToken, {
      filters: [{ field: "status", value: "short" }],
      limit: 100,
    }),
    queryMasterDocuments(PRODUCTION_COLLECTIONS.yields, idToken, { limit: 100 }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const byProduct: Record<string, number> = {};
  const byCustomer: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const trend: Record<string, number> = {};
  const workCenter: Record<string, number> = {};
  for (const order of orders) {
    byProduct[text(order.productId) || "unknown"] = (byProduct[text(order.productId) || "unknown"] || 0) + 1;
    byCustomer[text(order.customerId) || "unassigned"] = (byCustomer[text(order.customerId) || "unassigned"] || 0) + 1;
    byStatus[text(order.status)] = (byStatus[text(order.status)] || 0) + 1;
    const month = text(order.plannedStartDate).slice(0, 7) || "unknown";
    trend[month] = (trend[month] || 0) + 1;
    if (order.workCenterId) workCenter[text(order.workCenterId)] = (workCenter[text(order.workCenterId)] || 0) + 1;
  }
  const delayed = orders.filter(
    (row) =>
      text(row.plannedEndDate) &&
      text(row.plannedEndDate) < today &&
      !["completed", "qc_pending", "qa_pending", "released", "closed", "cancelled"].includes(text(row.status))
  );
  const lowYield = yields.filter((row) => text(row.result) === "below_limit");
  return {
    kpis: {
      plannedBatches: orders.filter((row) => ["draft", "planned", "approved"].includes(text(row.status))).length,
      scheduledBatches: schedules.filter((row) => ["scheduled", "ready"].includes(text(row.status))).length,
      inProgress: orders.filter((row) => ["manufacturing", "in_process", "dispensing_pending"].includes(text(row.status))).length,
      completed: orders.filter((row) => ["completed", "qc_pending", "qa_pending", "closed"].includes(text(row.status))).length,
      qcPending: orders.filter((row) => text(row.status) === "qc_pending").length,
      qaPending: orders.filter((row) => text(row.status) === "qa_pending").length,
      materialShortage: shortages.length,
      delayedBatches: delayed.length,
      lowYieldBatches: lowYield.length,
      openPlans: plans.filter((row) => !["completed", "cancelled"].includes(text(row.status))).length,
    },
    charts: { byProduct, byCustomer, byStatus, trend, workCenter },
  };
}

export async function loadBatchDetail(id: string, idToken: string) {
  const order = await readMasterDocument(PRODUCTION_COLLECTIONS.orders, id, idToken);
  if (!order) return null;
  const [items, bomItems, dispensing, bmrs, steps, ipc, yields, recon, wastage, deviations, equipment, operators, approvals, receipts] = await Promise.all([
    listByField(PRODUCTION_COLLECTIONS.orderItems, "manufacturingOrderId", id, idToken),
    order.bomId ? listByField(PRODUCTION_COLLECTIONS.bomItems, "bomId", text(order.bomId), idToken) : Promise.resolve([]),
    listByField(PRODUCTION_COLLECTIONS.dispensing, "manufacturingOrderId", id, idToken),
    listByField(PRODUCTION_COLLECTIONS.bmrs, "manufacturingOrderId", id, idToken),
    listByField(PRODUCTION_COLLECTIONS.steps, "manufacturingOrderId", id, idToken),
    queryMasterDocuments(PRODUCTION_COLLECTIONS.ipc, idToken, { limit: 50 }),
    listByField(PRODUCTION_COLLECTIONS.yields, "manufacturingOrderId", id, idToken),
    listByField(PRODUCTION_COLLECTIONS.reconciliations, "manufacturingOrderId", id, idToken),
    queryMasterDocuments(PRODUCTION_COLLECTIONS.wastage, idToken, { limit: 50 }),
    listByField(PRODUCTION_COLLECTIONS.deviations, "manufacturingOrderId", id, idToken),
    listByField(PRODUCTION_COLLECTIONS.equipmentAssignments, "manufacturingOrderId", id, idToken),
    listByField(PRODUCTION_COLLECTIONS.operatorAssignments, "manufacturingOrderId", id, idToken),
    loadApprovals("manufacturingOrder", id, idToken),
    queryMasterDocuments("goodsReceipts", idToken, { filters: [{ field: "sourceReference", value: text(order.batchNumber) }], limit: 10 }),
  ]);
  const bmr = bmrs[0];
  const ipcRows = bmr ? ipc.filter((row) => text(row.bmrId) === String(bmr.id)) : [];
  const wastageRows = bmr ? wastage.filter((row) => text(row.bmrId) === String(bmr.id)) : wastage;
  return {
    record: order,
    extra: {
      items,
      bomItems,
      dispensing,
      bmr,
      steps,
      ipc: ipcRows,
      yields,
      reconciliations: recon,
      wastage: wastageRows,
      deviations,
      equipment,
      operators,
      approvals,
      receipts,
    },
  };
}

export async function loadProductionReport(type: ProductionReportType, query: ProductionListQuery, idToken: string) {
  const collection =
    type === "production_plan"
      ? PRODUCTION_COLLECTIONS.plans
      : type === "production_schedule"
        ? PRODUCTION_COLLECTIONS.schedules
        : type === "material_reconciliation"
          ? PRODUCTION_COLLECTIONS.reconciliations
          : type === "batch_yield" || type === "production_loss"
            ? PRODUCTION_COLLECTIONS.yields
            : type === "material_shortage"
              ? PRODUCTION_COLLECTIONS.dispensingItems
              : PRODUCTION_COLLECTIONS.orders;
  const listed = await listProductionRecords(collection, { ...query, pageSize: query.pageSize || 50 }, idToken);
  if (type === "material_shortage") {
    return { rows: listed.rows.filter((row) => text(row.status) === "short" || Number(row.shortage || 0) > 0), nextCursor: listed.nextCursor };
  }
  if (type === "production_delay") {
    const today = new Date().toISOString().slice(0, 10);
    return {
      rows: listed.rows.filter(
        (row) => text(row.plannedEndDate) < today && !["completed", "closed", "cancelled", "qc_pending"].includes(text(row.status))
      ),
      nextCursor: listed.nextCursor,
    };
  }
  return listed;
}
