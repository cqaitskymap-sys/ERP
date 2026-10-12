import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import {
  classifyInventoryExpiry,
  daysUntil,
  INVENTORY_EXPIRY_WINDOWS_DAYS,
  isInventoryExpired,
} from "@/lib/inventory/expiry";
import { text } from "@/lib/inventory/helpers";
import { roundQuantity } from "@/lib/inventory/keys";
import { queryMasterDocuments, readMasterDocument, type MasterQueryFilter, type MasterRecord } from "@/lib/masters/firestore";
import type { InventoryReportType } from "@/types/inventory";

const SEARCH_END = "\uf8ff";

export interface InventoryListQuery {
  collection?: string;
  status?: string;
  qualityStatus?: string;
  inventoryStatus?: string;
  warehouseId?: string;
  locationId?: string;
  itemType?: string;
  itemId?: string;
  materialId?: string;
  productId?: string;
  batchNumber?: string;
  expiry?: string;
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

export async function listInventoryRecords(
  collection: string,
  query: InventoryListQuery,
  idToken: string
) {
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.qualityStatus) filters.push({ field: "qualityStatus", value: query.qualityStatus });
  if (query.inventoryStatus) filters.push({ field: "inventoryStatus", value: query.inventoryStatus });
  if (query.warehouseId) filters.push({ field: "warehouseId", value: query.warehouseId });
  if (query.locationId) filters.push({ field: "locationId", value: query.locationId });
  if (query.itemType) filters.push({ field: "itemType", value: query.itemType });
  const itemId = query.itemId || query.materialId || query.productId;
  if (itemId) filters.push({ field: "itemId", value: itemId });
  if (query.batchNumber) filters.push({ field: "batchNumber", value: query.batchNumber.toUpperCase() });

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

  if (query.expiry) {
    return listExpiryPage({
      fetchBatch: (startAfter) =>
        queryMasterDocuments(collection, idToken, {
          filters,
          orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
          startAfter,
          limit: 100,
        }),
      expiry: query.expiry,
      pageSize,
      cursorValues,
    });
  }

  const rows = await queryMasterDocuments(collection, idToken, {
    filters,
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    startAfter: cursorValues,
    limit: pageSize + 1,
  });
  return paginate(rows, pageSize, (row) => [String(row.updatedAt || "")]);
}

async function listExpiryPage(options: {
  fetchBatch: (startAfter?: Array<string | number>) => Promise<MasterRecord[]>;
  expiry: string;
  pageSize: number;
  cursorValues?: Array<string | number>;
}) {
  const matches: MasterRecord[] = [];
  let startAfter = options.cursorValues;
  let resume: Array<string | number> | undefined;
  let exhausted = false;

  for (let hop = 0; hop < 15 && matches.length <= options.pageSize; hop += 1) {
    const batch = await options.fetchBatch(startAfter);
    if (batch.length === 0) {
      exhausted = true;
      break;
    }
    for (const row of batch) {
      if (classifyInventoryExpiry(row.expiryDate) !== options.expiry) continue;
      matches.push(row);
      if (matches.length > options.pageSize) break;
    }
    if (matches.length > options.pageSize) break;
    const last = batch[batch.length - 1];
    resume = [String(last?.updatedAt || "")];
    if (batch.length < 100) {
      exhausted = true;
      break;
    }
    startAfter = resume;
  }

  if (matches.length > options.pageSize) {
    return paginate(matches, options.pageSize, (row) => [String(row.updatedAt || "")]);
  }
  return {
    rows: matches,
    nextCursor: exhausted || !resume ? null : encodeCursor(resume),
  };
}

function paginate(
  rows: MasterRecord[],
  pageSize: number,
  cursorOf: (row: MasterRecord) => Array<string | number>
) {
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null,
  };
}

export async function getInventoryRecord(collection: string, id: string, idToken: string) {
  const record = await readMasterDocument(collection, id, idToken);
  if (!record) return null;
  return record;
}

export async function listRelated(
  collection: string,
  field: string,
  value: string,
  idToken: string,
  limit = 100
) {
  return queryMasterDocuments(collection, idToken, {
    filters: [{ field, value }],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit,
  });
}

export async function loadWarehouseDashboard(idToken: string) {
  const [balances, receipts, transfers, issues, adjustments, materials] = await Promise.all([
    queryMasterDocuments(INVENTORY_COLLECTIONS.balances, idToken, { limit: 500 }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.receipts, idToken, { limit: 80 }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.transfers, idToken, { limit: 80 }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.issues, idToken, { limit: 80 }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.adjustments, idToken, { limit: 80 }),
    queryMasterDocuments("materials", idToken, { limit: 200 }),
  ]);

  const qty = (rows: MasterRecord[], predicate: (row: MasterRecord) => boolean) =>
    rows.filter(predicate).reduce((sum, row) => sum + roundQuantity(row.availableQuantity), 0);

  const byWarehouse: Record<string, number> = {};
  const byQuality: Record<string, number> = {};
  const byItemType: Record<string, number> = {};
  for (const row of balances) {
    const amount = roundQuantity(row.availableQuantity);
    byWarehouse[text(row.warehouseId)] = (byWarehouse[text(row.warehouseId)] || 0) + amount;
    byQuality[text(row.qualityStatus)] = (byQuality[text(row.qualityStatus)] || 0) + amount;
    byItemType[text(row.itemType)] = (byItemType[text(row.itemType)] || 0) + amount;
  }

  const expiryBuckets = Object.fromEntries(INVENTORY_EXPIRY_WINDOWS_DAYS.map((window) => [`expiring_${window}`, 0]));
  let expiredQty = 0;
  let nearExpiryQty = 0;
  let materialCount = 0;
  let productCount = 0;
  const seenMaterials = new Set<string>();
  const seenProducts = new Set<string>();
  for (const row of balances) {
    const state = classifyInventoryExpiry(row.expiryDate);
    const amount = roundQuantity(row.availableQuantity);
    if (state === "expired") expiredQty += amount;
    if (state.startsWith("expiring_")) {
      nearExpiryQty += amount;
      expiryBuckets[state] = (expiryBuckets[state] || 0) + amount;
    }
    if (row.itemType === "material" && row.itemId) {
      if (!seenMaterials.has(text(row.itemId))) {
        seenMaterials.add(text(row.itemId));
        materialCount += 1;
      }
    } else if (row.itemId) {
      if (!seenProducts.has(text(row.itemId))) {
        seenProducts.add(text(row.itemId));
        productCount += 1;
      }
    }
  }

  const availableByMaterial = new Map<string, number>();
  for (const row of balances) {
    if (row.itemType !== "material" || text(row.qualityStatus) !== "approved") continue;
    const key = text(row.itemId);
    availableByMaterial.set(key, (availableByMaterial.get(key) || 0) + roundQuantity(row.availableQuantity));
  }
  let belowMinimum = 0;
  let reorderRequired = 0;
  let critical = 0;
  for (const material of materials) {
    const onHand = availableByMaterial.get(String(material.id)) || 0;
    const min = Number(material.minimumStock || 0);
    const reorder = Number(material.reorderLevel || 0);
    if (min > 0 && onHand < min) belowMinimum += 1;
    if (reorder > 0 && onHand <= reorder) reorderRequired += 1;
    if (min > 0 && onHand <= min * 0.5) critical += 1;
  }

  const movement = [
    { type: "Receipts", count: receipts.filter((row) => row.status === "received" || row.status === "completed").length },
    { type: "Transfers", count: transfers.filter((row) => row.status === "completed").length },
    { type: "Issues", count: issues.filter((row) => row.status === "issued").length },
    { type: "Adjustments", count: adjustments.filter((row) => row.status === "approved").length },
  ];

  return {
    window: balances.length,
    expiryWindows: INVENTORY_EXPIRY_WINDOWS_DAYS,
    kpis: {
      totalInventory: qty(balances, () => true),
      availableStock: qty(balances, (row) => row.qualityStatus === "approved" && row.inventoryStatus === "available"),
      quarantineStock: qty(balances, (row) => row.qualityStatus === "quarantine"),
      blockedStock: qty(balances, (row) => row.qualityStatus === "blocked"),
      rejectedStock: qty(balances, (row) => row.qualityStatus === "rejected"),
      expiredStock: expiredQty,
      nearExpiry: nearExpiryQty,
      lowStock: belowMinimum + reorderRequired,
    },
    expiry: {
      expiredQty,
      nearExpiryQty,
      materialCount,
      productCount,
      buckets: { expired: expiredQty, ...expiryBuckets },
    },
    lowStock: { belowMinimum, reorderRequired, critical },
    charts: {
      byItemType,
      byWarehouse,
      byQuality,
      expiryBuckets,
      movement,
    },
    pending: {
      receipts: receipts.filter((row) => row.status === "draft" || row.status === "received").length,
      transfers: transfers.filter((row) => row.status === "requested" || row.status === "approved").length,
      issues: issues.filter((row) => row.status === "requested" || row.status === "approved").length,
      adjustments: adjustments.filter((row) => row.status === "requested").length,
    },
  };
}

export async function loadQuarantineDashboard(idToken: string) {
  const rows = await queryMasterDocuments(INVENTORY_COLLECTIONS.balances, idToken, {
    filters: [{ field: "qualityStatus", value: "quarantine" }],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit: 200,
  });
  const now = new Date();
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const batch = row.inventoryBatchId
        ? await readMasterDocument(INVENTORY_COLLECTIONS.batches, text(row.inventoryBatchId), idToken)
        : null;
      const received = text(batch?.receivedDate || row.createdAt);
      return {
        ...row,
        supplierId: text(batch?.supplierId),
        receivedDate: received,
        daysInQuarantine: daysUntil(received, now) === null ? 0 : Math.abs(daysUntil(received, now) || 0),
        qcStatus: text(batch?.qcStatus || "pending"),
        qaStatus: text(batch?.qaStatus || "pending"),
      };
    })
  );
  return {
    totalItems: enriched.length,
    quarantineQuantity: enriched.reduce(
      (sum, row) => sum + roundQuantity((row as MasterRecord).availableQuantity),
      0
    ),
    pendingQc: enriched.filter((row) => row.qcStatus === "pending").length,
    overdueTesting: enriched.filter((row) => Number(row.daysInQuarantine) >= 7 && row.qcStatus === "pending").length,
    recentlyReceived: enriched.filter((row) => Number(row.daysInQuarantine) <= 2).length,
    aging: enriched.filter((row) => Number(row.daysInQuarantine) >= 14).length,
    rows: enriched,
  };
}

export async function loadStockCard(query: InventoryListQuery, idToken: string) {
  const filters: MasterQueryFilter[] = [];
  const itemId = query.itemId || query.materialId || query.productId;
  if (itemId) filters.push({ field: "itemId", value: itemId });
  if (query.batchNumber) filters.push({ field: "batchNumber", value: query.batchNumber.toUpperCase() });
  if (query.warehouseId) filters.push({ field: "warehouseId", value: query.warehouseId });
  if (query.locationId) filters.push({ field: "locationId", value: query.locationId });
  if (query.qualityStatus) filters.push({ field: "qualityStatus", value: query.qualityStatus });
  const rows = await queryMasterDocuments(INVENTORY_COLLECTIONS.ledger, idToken, {
    filters,
    orderBy: [{ field: "performedAt", direction: "ASCENDING" }],
    limit: 400,
  });
  const from = query.from ? new Date(query.from).getTime() : 0;
  const to = query.to ? new Date(query.to).getTime() : Number.POSITIVE_INFINITY;
  const inRange = rows.filter((row) => {
    const time = new Date(text(row.performedAt)).getTime();
    return time >= from && time <= to;
  });
  const openingRows = rows.filter((row) => new Date(text(row.performedAt)).getTime() < from);
  const lastOpening = openingRows[openingRows.length - 1];
  const opening = lastOpening ? roundQuantity(lastOpening.balanceAfter) : 0;
  const totals = inRange.reduce(
    (acc, row) => {
      acc.in += roundQuantity(row.quantityIn);
      acc.out += roundQuantity(row.quantityOut);
      return acc;
    },
    { in: 0, out: 0 }
  );
  return {
    opening,
    receipts: inRange.filter((row) => row.transactionType === "RECEIPT").reduce((sum, row) => sum + roundQuantity(row.quantityIn), 0),
    transfersIn: inRange.filter((row) => row.transactionType === "TRANSFER_IN").reduce((sum, row) => sum + roundQuantity(row.quantityIn), 0),
    transfersOut: inRange.filter((row) => row.transactionType === "TRANSFER_OUT").reduce((sum, row) => sum + roundQuantity(row.quantityOut), 0),
    issues: inRange.filter((row) => row.transactionType === "ISSUE").reduce((sum, row) => sum + roundQuantity(row.quantityOut), 0),
    returns: inRange.filter((row) => row.transactionType === "RETURN").reduce((sum, row) => sum + roundQuantity(row.quantityIn), 0),
    adjustmentsIn: inRange.filter((row) => row.transactionType === "ADJUSTMENT_IN").reduce((sum, row) => sum + roundQuantity(row.quantityIn), 0),
    adjustmentsOut: inRange.filter((row) => row.transactionType === "ADJUSTMENT_OUT").reduce((sum, row) => sum + roundQuantity(row.quantityOut), 0),
    closing: opening + totals.in - totals.out,
    rows: inRange,
  };
}

export async function loadBatchTraceability(batchNumber: string, idToken: string) {
  const number = batchNumber.trim().toUpperCase();
  const [batches, balances, ledger, history, events] = await Promise.all([
    queryMasterDocuments(INVENTORY_COLLECTIONS.batches, idToken, {
      filters: [{ field: "batchNumber", value: number }],
      limit: 20,
    }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.balances, idToken, {
      filters: [{ field: "batchNumber", value: number }],
      limit: 50,
    }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.ledger, idToken, {
      filters: [{ field: "batchNumber", value: number }],
      orderBy: [{ field: "performedAt", direction: "ASCENDING" }],
      limit: 200,
    }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.statusHistory, idToken, { limit: 100 }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.traceability, idToken, {
      filters: [{ field: "batchNumber", value: number }],
      orderBy: [{ field: "performedAt", direction: "ASCENDING" }],
      limit: 200,
    }),
  ]);
  const batchIds = new Set(batches.map((row) => String(row.id)));
  return {
    batches,
    balances,
    ledger,
    history: history.filter((row) => batchIds.has(text(row.inventoryBatchId))),
    events,
    currentQuantity: balances.reduce((sum, row) => sum + roundQuantity(row.availableQuantity), 0),
  };
}

export async function loadWarehouseReport(
  type: InventoryReportType,
  query: InventoryListQuery,
  idToken: string
) {
  if (type === "stock_ledger" || type === "stock_movement") {
    return listInventoryRecords(INVENTORY_COLLECTIONS.ledger, query, idToken);
  }
  if (type === "material_issue") return listInventoryRecords(INVENTORY_COLLECTIONS.issues, query, idToken);
  if (type === "material_return") return listInventoryRecords(INVENTORY_COLLECTIONS.returns, query, idToken);
  if (type === "stock_adjustment") return listInventoryRecords(INVENTORY_COLLECTIONS.adjustments, query, idToken);
  if (type === "batch_traceability" && query.batchNumber) {
    const result = await loadBatchTraceability(query.batchNumber, idToken);
    return { rows: result.ledger, nextCursor: null, extra: result };
  }

  const qualityMap: Partial<Record<InventoryReportType, string>> = {
    quarantine_stock: "quarantine",
    rejected_stock: "rejected",
    blocked_stock: "blocked",
  };
  const expiryMap: Partial<Record<InventoryReportType, string>> = {
    near_expiry: "expiring_90",
    expired_stock: "expired",
  };
  return listInventoryRecords(
    INVENTORY_COLLECTIONS.balances,
    {
      ...query,
      qualityStatus: qualityMap[type] || query.qualityStatus,
      expiry: expiryMap[type] || query.expiry,
      pageSize: query.pageSize || 100,
    },
    idToken
  );
}

export async function loadExpiryMonitor(idToken: string) {
  const rows = await queryMasterDocuments(INVENTORY_COLLECTIONS.balances, idToken, { limit: 400 });
  const groups: Record<string, MasterRecord[]> = {
    expired: [],
    expiring_7: [],
    expiring_30: [],
    expiring_60: [],
    expiring_90: [],
  };
  for (const row of rows) {
    const state = classifyInventoryExpiry(row.expiryDate);
    if (state in groups) groups[state].push(row);
  }
  return {
    windows: INVENTORY_EXPIRY_WINDOWS_DAYS,
    counts: Object.fromEntries(
      Object.entries(groups).map(([key, value]) => [key, value.length])
    ),
    quantities: Object.fromEntries(
      Object.entries(groups).map(([key, value]) => [
        key,
        value.reduce((sum, row) => sum + roundQuantity(row.availableQuantity), 0),
      ])
    ),
    rows: groups,
    expiredAuto: rows.filter((row) => isInventoryExpired(row.expiryDate)).length,
  };
}

export async function loadLowStock(idToken: string) {
  const [balances, materials] = await Promise.all([
    queryMasterDocuments(INVENTORY_COLLECTIONS.balances, idToken, { limit: 400 }),
    queryMasterDocuments("materials", idToken, { limit: 200 }),
  ]);
  const onHand = new Map<string, number>();
  for (const row of balances) {
    if (row.itemType !== "material") continue;
    onHand.set(text(row.itemId), (onHand.get(text(row.itemId)) || 0) + roundQuantity(row.availableQuantity));
  }
  return materials
    .map((material) => {
      const quantity = onHand.get(String(material.id)) || 0;
      const minimumStock = Number(material.minimumStock || 0);
      const reorderLevel = Number(material.reorderLevel || 0);
      const maximumStock = Number(material.maximumStock || 0);
      let level = "ok";
      if (minimumStock > 0 && quantity <= minimumStock * 0.5) level = "critical";
      else if (minimumStock > 0 && quantity < minimumStock) level = "below_minimum";
      else if (reorderLevel > 0 && quantity <= reorderLevel) level = "reorder";
      return {
        id: String(material.id),
        materialCode: material.materialCode,
        materialName: material.materialName,
        uom: material.uom,
        quantity,
        minimumStock,
        reorderLevel,
        maximumStock,
        level,
      };
    })
    .filter((row) => row.level !== "ok" && (row.minimumStock > 0 || row.reorderLevel > 0));
}

export async function loadBatchDetail(id: string, idToken: string) {
  const batch = await readMasterDocument(INVENTORY_COLLECTIONS.batches, id, idToken);
  if (!batch) return null;
  const [balances, ledger, history, events, documents] = await Promise.all([
    queryMasterDocuments(INVENTORY_COLLECTIONS.balances, idToken, {
      filters: [{ field: "inventoryBatchId", value: id }],
      limit: 50,
    }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.ledger, idToken, {
      filters: [{ field: "batchNumber", value: text(batch.batchNumber) }],
      orderBy: [{ field: "performedAt", direction: "ASCENDING" }],
      limit: 100,
    }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.statusHistory, idToken, {
      filters: [{ field: "inventoryBatchId", value: id }],
      limit: 50,
    }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.traceability, idToken, {
      filters: [{ field: "inventoryBatchId", value: id }],
      orderBy: [{ field: "performedAt", direction: "ASCENDING" }],
      limit: 100,
    }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.documents, idToken, {
      filters: [{ field: "inventoryBatchId", value: id }],
      limit: 50,
    }),
  ]);
  return { batch, balances, ledger, history, events, documents };
}
