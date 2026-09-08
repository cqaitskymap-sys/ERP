import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import { classifyInventoryExpiry } from "@/lib/inventory/expiry";
import { text } from "@/lib/logistics/helpers";
import { LOGISTICS_COLLECTIONS } from "@/lib/logistics/collections";
import { calculateWarehouseUtilization } from "@/lib/logistics/scoring";
import { queryMasterDocuments, readMasterDocument, type MasterQueryFilter, type MasterRecord } from "@/lib/masters/firestore";
import { LOGISTICS_REPORT_TYPES } from "@/types/logistics";

const SEARCH_END = "\uf8ff";

export interface LogisticsListQuery {
  status?: string;
  warehouseId?: string;
  customerId?: string;
  batchNumber?: string;
  shipmentId?: string;
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

export async function listLogisticsRecords(collection: string, query: LogisticsListQuery, idToken: string) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.warehouseId) filters.push({ field: "warehouseId", value: query.warehouseId });
  if (query.customerId) filters.push({ field: "customerId", value: query.customerId });
  if (query.batchNumber) filters.push({ field: "batchNumber", value: query.batchNumber });
  if (query.shipmentId) filters.push({ field: "shipmentId", value: query.shipmentId });
  const search = query.search?.trim().toLowerCase();
  const cursorValues = decodeCursor(query.cursor);
  const rows = search
    ? await queryMasterDocuments(collection, idToken, {
        filters: [
          ...filters,
          { field: "searchIndex", op: "GREATER_THAN_OR_EQUAL", value: search },
          { field: "searchIndex", op: "LESS_THAN", value: `${search}${SEARCH_END}` },
        ],
        orderBy: [{ field: "searchIndex" }],
        startAfter: cursorValues,
        limit: pageSize + 1,
      })
    : await queryMasterDocuments(collection, idToken, {
        filters,
        orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
        startAfter: cursorValues,
        limit: pageSize + 1,
      });
  return paginate(rows, pageSize, (row) => [String(search ? row.searchIndex || "" : row.updatedAt || "")]);
}

export async function loadLogisticsDashboard(idToken: string) {
  const [warehouses, locations, balances, receipts, putaways, picks, shipments, excursions] = await Promise.all([
    queryMasterDocuments("warehouses", idToken, { limit: 80 }),
    queryMasterDocuments("storageLocations", idToken, { limit: 200 }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.balances, idToken, { limit: 400 }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.receipts, idToken, { limit: 80 }),
    queryMasterDocuments(LOGISTICS_COLLECTIONS.putaways, idToken, { limit: 80 }).catch(() => []),
    queryMasterDocuments(LOGISTICS_COLLECTIONS.picks, idToken, { limit: 80 }).catch(() => []),
    queryMasterDocuments(LOGISTICS_COLLECTIONS.shipments, idToken, { limit: 80 }).catch(() => []),
    queryMasterDocuments(LOGISTICS_COLLECTIONS.excursions, idToken, { limit: 80 }).catch(() => []),
  ]);
  const qty = (predicate: (row: MasterRecord) => boolean) =>
    balances.filter(predicate).reduce((sum, row) => sum + Number(row.availableQuantity || 0), 0);
  const byWarehouse: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byItem: Record<string, number> = {};
  for (const row of balances) {
    const amount = Number(row.availableQuantity || 0);
    byWarehouse[text(row.warehouseId)] = (byWarehouse[text(row.warehouseId)] || 0) + amount;
    byStatus[text(row.qualityStatus)] = (byStatus[text(row.qualityStatus)] || 0) + amount;
    byItem[text(row.itemName || row.itemCode)] = (byItem[text(row.itemName || row.itemCode)] || 0) + amount;
  }
  const shipmentStatus: Record<string, number> = {};
  for (const row of shipments) shipmentStatus[text(row.status)] = (shipmentStatus[text(row.status)] || 0) + 1;
  const excursionTrend: Record<string, number> = {};
  for (const row of excursions) excursionTrend[text(row.detectedAt || row.createdAt).slice(0, 7) || "unknown"] = (excursionTrend[text(row.detectedAt || row.createdAt).slice(0, 7) || "unknown"] || 0) + 1;
  const skus = new Set(balances.map((row) => text(row.itemId)).filter(Boolean));
  return {
    kpis: {
      totalWarehouses: warehouses.length,
      totalLocations: locations.length,
      totalSkus: skus.size,
      totalInventoryValue: qty(() => true),
      quarantineStock: qty((row) => text(row.qualityStatus) === "quarantine"),
      releasedStock: qty((row) => text(row.qualityStatus) === "approved"),
      blockedStock: qty((row) => text(row.qualityStatus) === "blocked"),
      expiredStock: qty((row) => classifyInventoryExpiry(row.expiryDate) === "expired"),
      nearExpiryStock: qty((row) => classifyInventoryExpiry(row.expiryDate).startsWith("expiring_")),
      pendingReceipts: receipts.filter((row) => ["draft", "received"].includes(text(row.status))).length,
      pendingPutAway: putaways.filter((row) => text(row.status) !== "confirmed" && text(row.status) !== "cancelled").length,
      pendingPicks: picks.filter((row) => !["verified", "cancelled"].includes(text(row.status))).length,
      pendingDispatches: shipments.filter((row) => ["draft", "ready", "packed"].includes(text(row.status))).length,
      inTransitShipments: shipments.filter((row) => text(row.status) === "in_transit").length,
      coldChainShipments: shipments.filter((row) => Boolean(row.temperatureControlled)).length,
      activeExcursions: excursions.filter((row) => !["closed", "released"].includes(text(row.status))).length,
    },
    charts: {
      byWarehouse,
      byStatus,
      byItem,
      shipmentStatus,
      excursionTrend,
      utilization: calculateWarehouseUtilization(locations.map((row) => ({ capacity: row.capacity, used: row.usedCapacity, status: row.status }))),
    },
  };
}

export async function loadWarehouse360(id: string, idToken: string) {
  const warehouse = await readMasterDocument("warehouses", id, idToken);
  if (!warehouse) return null;
  const [locations, inventory, picks, shipments, returns, excursions, incidents] = await Promise.all([
    queryMasterDocuments("storageLocations", idToken, { filters: [{ field: "warehouseId", value: id }], limit: 80 }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.balances, idToken, { filters: [{ field: "warehouseId", value: id }], limit: 80 }),
    queryMasterDocuments(LOGISTICS_COLLECTIONS.picks, idToken, { filters: [{ field: "warehouseId", value: id }], limit: 20 }).catch(() => []),
    queryMasterDocuments(LOGISTICS_COLLECTIONS.shipments, idToken, { filters: [{ field: "warehouseId", value: id }], limit: 20 }).catch(() => []),
    queryMasterDocuments(LOGISTICS_COLLECTIONS.returns, idToken, { filters: [{ field: "warehouseId", value: id }], limit: 20 }).catch(() => []),
    queryMasterDocuments(LOGISTICS_COLLECTIONS.excursions, idToken, { filters: [{ field: "warehouseId", value: id }], limit: 20 }).catch(() => []),
    queryMasterDocuments(LOGISTICS_COLLECTIONS.incidents, idToken, { filters: [{ field: "warehouseId", value: id }], limit: 20 }).catch(() => []),
  ]);
  return {
    record: warehouse,
    extra: {
      locations,
      inventory,
      picks,
      shipments,
      returns,
      excursions,
      incidents,
      utilization: calculateWarehouseUtilization(locations.map((row) => ({ capacity: row.capacity, used: row.usedCapacity, status: row.status }))),
    },
  };
}

export async function loadShipmentDetail(id: string, idToken: string) {
  const record = await readMasterDocument(LOGISTICS_COLLECTIONS.shipments, id, idToken);
  if (!record) return null;
  const [items, temperatures, excursions] = await Promise.all([
    queryMasterDocuments(LOGISTICS_COLLECTIONS.shipmentItems, idToken, { filters: [{ field: "shipmentId", value: id }], limit: 50 }).catch(() => []),
    queryMasterDocuments(LOGISTICS_COLLECTIONS.temperatures, idToken, { filters: [{ field: "shipmentId", value: id }], limit: 80 }).catch(() => []),
    queryMasterDocuments(LOGISTICS_COLLECTIONS.excursions, idToken, { filters: [{ field: "shipmentId", value: id }], limit: 20 }).catch(() => []),
  ]);
  return { record, extra: { items, temperatures, excursions } };
}

export async function loadCustomerDistribution(customerId: string, idToken: string) {
  const customer = await readMasterDocument("customers", customerId, idToken);
  if (!customer) return null;
  const [shipments, returns] = await Promise.all([
    queryMasterDocuments(LOGISTICS_COLLECTIONS.shipments, idToken, { filters: [{ field: "customerId", value: customerId }], limit: 50 }),
    queryMasterDocuments(LOGISTICS_COLLECTIONS.returns, idToken, { filters: [{ field: "customerId", value: customerId }], limit: 30 }),
  ]);
  const recalls = await queryMasterDocuments("complaintRecalls", idToken, { limit: 20 }).catch(() => []);
  return { record: customer, extra: { shipments, returns, recalls } };
}

export async function loadRecallDistribution(batchNumber: string, idToken: string) {
  const [items, returns, balances] = await Promise.all([
    queryMasterDocuments(LOGISTICS_COLLECTIONS.shipmentItems, idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 50 }).catch(() => []),
    queryMasterDocuments(LOGISTICS_COLLECTIONS.returns, idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 30 }).catch(() => []),
    queryMasterDocuments(INVENTORY_COLLECTIONS.balances, idToken, { filters: [{ field: "batchNumber", value: batchNumber }], limit: 30 }).catch(() => []),
  ]);
  return {
    record: { batchNumber },
    extra: { shipments: items, returns, balances },
  };
}

export async function loadLogisticsReport(type: (typeof LOGISTICS_REPORT_TYPES)[number], query: LogisticsListQuery, idToken: string) {
  const collection =
    type === "putaway" ? LOGISTICS_COLLECTIONS.putaways
      : type === "picking" ? LOGISTICS_COLLECTIONS.picks
        : type === "packing" ? LOGISTICS_COLLECTIONS.packing
          : type === "shipment" || type === "dispatch" || type === "customer_distribution" || type === "cold_chain" ? LOGISTICS_COLLECTIONS.shipments
            : type === "return" ? LOGISTICS_COLLECTIONS.returns
              : type === "cycle_count" || type === "variance" ? LOGISTICS_COLLECTIONS.cycleCounts
                : type === "temperature" ? LOGISTICS_COLLECTIONS.temperatures
                  : type === "excursion" ? LOGISTICS_COLLECTIONS.excursions
                    : type === "incident" ? LOGISTICS_COLLECTIONS.incidents
                      : type === "movement" ? LOGISTICS_COLLECTIONS.movements
                        : type === "batch_distribution" || type === "recall_distribution" ? LOGISTICS_COLLECTIONS.shipmentItems
                          : INVENTORY_COLLECTIONS.balances;
  return listLogisticsRecords(collection, { ...query, pageSize: query.pageSize || 50 }, idToken);
}

export { decodeCursor };
