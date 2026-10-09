import { COSTING_COLLECTIONS } from "@/lib/costing/collections";
import { COSTING_RESOURCES, type CostingResource } from "@/lib/costing/http";
import { text } from "@/lib/costing/helpers";
import { addMoney, money } from "@/lib/finance/money";
import {
  queryMasterDocuments,
  type MasterQueryFilter,
  type MasterRecord,
} from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";
import type { CostingReportType } from "@/types/costing";
import { calculateCustomerProfitability, calculateProductProfitability } from "@/lib/costing/server";

const SEARCH_END = "\uf8ff";

export interface CostingListQuery {
  status?: string;
  productId?: string;
  batchNumber?: string;
  manufacturingOrderId?: string;
  customerId?: string;
  costCenterId?: string;
  departmentId?: string;
  siteId?: string;
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

export async function listCostingRecords(
  resource: CostingResource,
  query: CostingListQuery,
  idToken: string,
  _session: SessionPayload
) {
  const collection = COSTING_RESOURCES[resource].collection;
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20), 1), 100);
  const filters: MasterQueryFilter[] = [];
  if (query.status && query.status !== "all") filters.push({ field: "status", value: query.status });
  if (query.productId) filters.push({ field: "productId", value: query.productId });
  if (query.customerId) filters.push({ field: "customerId", value: query.customerId });
  if (query.costCenterId) filters.push({ field: "costCenterId", value: query.costCenterId });
  if (query.manufacturingOrderId) filters.push({ field: "manufacturingOrderId", value: query.manufacturingOrderId });

  const search = query.search?.trim().toLowerCase();
  const cursorValues = decodeCursor(query.cursor);
  let rows: MasterRecord[];
  if (search) {
    rows = await queryMasterDocuments(collection, idToken, {
      filters: [
        ...filters,
        { field: "searchIndex", op: "GREATER_THAN_OR_EQUAL", value: search },
        { field: "searchIndex", op: "LESS_THAN", value: `${search}${SEARCH_END}` },
      ],
      orderBy: [{ field: "searchIndex" }],
      startAfter: cursorValues,
      limit: pageSize + 1,
    });
  } else {
    rows = await queryMasterDocuments(collection, idToken, {
      filters,
      orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
      startAfter: cursorValues,
      limit: pageSize + 1,
    });
  }

  if (query.from || query.to || query.batchNumber || query.departmentId || query.siteId) {
    rows = rows.filter((row) => {
      if (query.batchNumber && text(row.batchNumber) !== query.batchNumber) return false;
      if (query.departmentId && text(row.departmentId) !== query.departmentId) return false;
      if (query.siteId && text(row.siteId) !== query.siteId) return false;
      const date = text(row.calculationTimestamp || row.effectiveFrom || row.createdAt).slice(0, 10);
      if (query.from && date < query.from) return false;
      if (query.to && date > query.to) return false;
      return true;
    });
  }

  return paginate(rows, pageSize, (row) =>
    search ? [String(row.searchIndex || "")] : [String(row.updatedAt || "")]
  );
}

export async function loadCostingDashboard(idToken: string, query: CostingListQuery = {}) {
  const [batches, standards, investigations, approvals] = await Promise.all([
    queryMasterDocuments(COSTING_COLLECTIONS.batchRecords, idToken, { limit: 400 }),
    queryMasterDocuments(COSTING_COLLECTIONS.productStandards, idToken, { limit: 200 }),
    queryMasterDocuments(COSTING_COLLECTIONS.varianceInvestigations, idToken, { limit: 100 }),
    queryMasterDocuments(COSTING_COLLECTIONS.approvals, idToken, {
      filters: [{ field: "status", value: "pending" }],
      limit: 100,
    }).catch(() => []),
  ]);

  const filtered = batches.filter((row) => {
    if (["cancelled", "superseded"].includes(text(row.status))) return false;
    if (query.productId && text(row.productId) !== query.productId) return false;
    if (query.customerId && text(row.customerId) !== query.customerId) return false;
    if (query.costCenterId && text(row.costCenterId) !== query.costCenterId) return false;
    if (query.departmentId && text(row.departmentId) !== query.departmentId) return false;
    if (query.siteId && text(row.siteId) !== query.siteId) return false;
    if (query.batchNumber && text(row.batchNumber) !== query.batchNumber) return false;
    const date = text(row.calculationTimestamp || row.createdAt).slice(0, 10);
    if (query.from && date < query.from) return false;
    if (query.to && date > query.to) return false;
    return true;
  });

  const totalManufacturingCost = filtered.reduce((sum, row) => addMoney(sum, row.totalBatchCost), 0);
  const standardTotal = filtered.reduce((sum, row) => {
    const std = standards.find((s) => String(s.id) === text(row.productStandardId));
    return addMoney(sum, std?.totalBatchCost);
  }, 0);
  const avgBatch = filtered.length ? money(totalManufacturingCost / filtered.length) : 0;
  const avgUnit =
    filtered.length > 0
      ? money(filtered.reduce((sum, row) => addMoney(sum, row.costPerUnit), 0) / filtered.length)
      : 0;

  const sumComponent = (field: string) => filtered.reduce((sum, row) => addMoney(sum, row[field]), 0);
  const material = sumComponent("materialCost");
  const packaging = sumComponent("packagingCost");
  const labor = sumComponent("laborCost");
  const overhead = sumComponent("overheadCost");
  const wastage = sumComponent("wastageCost");
  const rework = sumComponent("reworkCost");
  const quality = sumComponent("qualityCost");

  const pct = (part: number) => (totalManufacturingCost > 0 ? money((part / totalManufacturingCost) * 100) : 0);

  const highVariance = filtered
    .map((row) => {
      const summary = (row.varianceSummary || {}) as Record<string, unknown>;
      return {
        id: String(row.id),
        productId: text(row.productId),
        batchNumber: text(row.batchNumber),
        variance: money(summary.totalVariance),
        unexplained: !text(row.varianceExplanation) && money(summary.totalUnfavorable) > 0,
      };
    })
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 10);

  const incomplete = filtered.filter((row) => text(row.completenessStatus) === "incomplete");
  const pendingApprovals = filtered.filter((row) =>
    ["validation", "department_review", "costing_review", "finance_review"].includes(text(row.status))
  );
  const awaitingFinance = filtered.filter((row) => text(row.status) === "finalized");

  const margins = filtered
    .filter((row) => money(row.costPerUnit) > 0)
    .slice(0, 20)
    .map((row) => ({
      id: String(row.id),
      productId: text(row.productId),
      costPerUnit: money(row.costPerUnit),
      dataQuality: text(row.dataQuality),
      marginAvailable: false,
      note: "Gross margin requires linked sales invoice prices.",
    }));

  return {
    kpis: {
      totalManufacturingCost,
      standardVersusActual: money(totalManufacturingCost - standardTotal),
      averageCostPerBatch: filtered.length ? avgBatch : 0,
      averageCostPerUnit: avgUnit,
      materialCostPercent: pct(material),
      packagingCostPercent: pct(packaging),
      laborCostPercent: pct(labor),
      overheadPercent: pct(overhead),
      materialWastageCost: wastage,
      reworkCost: rework,
      qualityRelatedCost: quality,
      costVariance: money(totalManufacturingCost - standardTotal),
      pendingCostingApprovals: pendingApprovals.length + approvals.length,
      incompleteCostRecords: incomplete.length,
      awaitingFinanceReconciliation: awaitingFinance.length,
      batchCount: filtered.length,
    },
    highestVarianceProducts: highVariance,
    unexplainedVarianceBatches: highVariance.filter((row) => row.unexplained),
    incompleteRecords: incomplete.slice(0, 12).map((row) => ({
      id: String(row.id),
      batchCostingNumber: text(row.batchCostingNumber),
      missingComponents: row.missingComponents || [],
      status: text(row.status),
    })),
    pendingApprovals: pendingApprovals.slice(0, 12).map((row) => ({
      id: String(row.id),
      batchCostingNumber: text(row.batchCostingNumber),
      status: text(row.status),
      productId: text(row.productId),
    })),
    marginPreview: margins,
    note:
      filtered.length === 0
        ? "No costing records for the selected filters. Figures remain unavailable until batches are costed from source data."
        : undefined,
  };
}

export async function loadPendingCostingApprovals(idToken: string) {
  const batches = await queryMasterDocuments(COSTING_COLLECTIONS.batchRecords, idToken, { limit: 200 });
  const standards = await queryMasterDocuments(COSTING_COLLECTIONS.productStandards, idToken, { limit: 100 });
  const reviewStatuses = ["validation", "department_review", "costing_review", "finance_review", "calculated"];
  return {
    rows: [
      ...batches
        .filter((row) => reviewStatuses.includes(text(row.status)))
        .map((row) => ({ ...row, resource: "batches" })),
      ...standards
        .filter((row) => reviewStatuses.includes(text(row.status)))
        .map((row) => ({ ...row, resource: "standards" })),
    ],
  };
}

export async function loadCostingReport(
  type: CostingReportType,
  query: CostingListQuery,
  idToken: string,
  session: SessionPayload
) {
  const batches = await queryMasterDocuments(COSTING_COLLECTIONS.batchRecords, idToken, { limit: 500 });
  const standards = await queryMasterDocuments(COSTING_COLLECTIONS.productStandards, idToken, { limit: 300 });
  const inRange = (row: MasterRecord) => {
    const date = text(row.calculationTimestamp || row.createdAt).slice(0, 10);
    if (query.from && date < query.from) return false;
    if (query.to && date > query.to) return false;
    if (query.productId && text(row.productId) !== query.productId) return false;
    if (query.customerId && text(row.customerId) !== query.customerId) return false;
    if (query.costCenterId && text(row.costCenterId) !== query.costCenterId) return false;
    return true;
  };

  let rows: MasterRecord[] = [];
  let meta: Record<string, unknown> | undefined;

  switch (type) {
    case "batch_cost_register":
      rows = batches.filter(inRange);
      break;
    case "standard_vs_actual":
      rows = batches.filter(inRange).map((row) => {
        const std = standards.find((s) => String(s.id) === text(row.productStandardId));
        return {
          ...row,
          standardTotal: money(std?.totalBatchCost),
          actualTotal: money(row.totalBatchCost),
          variance: money(money(row.totalBatchCost) - money(std?.totalBatchCost)),
        };
      });
      break;
    case "variance_summary": {
      const variances = await queryMasterDocuments(COSTING_COLLECTIONS.varianceAnalyses, idToken, { limit: 300 });
      rows = variances;
      break;
    }
    case "material_cost":
      rows = batches.filter(inRange).map((row) => ({
        id: String(row.id),
        batchCostingNumber: row.batchCostingNumber,
        materialCost: row.materialCost,
        materialCostPercent: row.materialCostPercent,
      }));
      break;
    case "packaging_cost":
      rows = batches.filter(inRange).map((row) => ({
        id: String(row.id),
        packagingCost: row.packagingCost,
        packagingCostPercent: row.packagingCostPercent,
      }));
      break;
    case "labor_cost":
      rows = batches.filter(inRange).map((row) => ({ id: String(row.id), laborCost: row.laborCost }));
      break;
    case "machine_cost":
      rows = batches.filter(inRange).map((row) => ({ id: String(row.id), machineCost: row.machineCost }));
      break;
    case "overhead_allocation": {
      const allocations = await queryMasterDocuments(COSTING_COLLECTIONS.allocations, idToken, { limit: 200 });
      rows = allocations.length
        ? allocations
        : batches.filter(inRange).map((row) => ({ id: String(row.id), overheadCost: row.overheadCost }));
      break;
    }
    case "yield_wastage":
      rows = batches.filter(inRange).map((row) => ({
        id: String(row.id),
        yieldMetrics: row.yieldMetrics,
        wastageCost: row.wastageCost,
      }));
      break;
    case "rework_cost":
      rows = batches.filter(inRange).map((row) => ({ id: String(row.id), reworkCost: row.reworkCost }));
      break;
    case "quality_cost":
      rows = batches.filter(inRange).map((row) => ({ id: String(row.id), qualityCost: row.qualityCost }));
      break;
    case "cost_center": {
      const grouped: Record<string, number> = {};
      for (const row of batches.filter(inRange)) {
        const key = text(row.costCenterId) || "unassigned";
        grouped[key] = money((grouped[key] || 0) + money(row.totalBatchCost));
      }
      rows = Object.entries(grouped).map(([costCenterId, amount]) => ({ id: costCenterId, costCenterId, amount }));
      break;
    }
    case "product_profitability": {
      if (!query.productId) {
        rows = [{ id: "missing", note: "Select a productId filter to calculate product profitability." }];
        break;
      }
      const result = await calculateProductProfitability({
        productId: query.productId,
        idToken,
        session,
      });
      rows = [{ id: query.productId, ...result }];
      meta = result;
      break;
    }
    case "customer_profitability": {
      if (!query.customerId) {
        rows = [{ id: "missing", note: "Select a customerId filter to calculate customer profitability." }];
        break;
      }
      const result = await calculateCustomerProfitability({
        customerId: query.customerId,
        idToken,
        session,
      });
      rows = [{ id: query.customerId, ...result }];
      meta = result;
      break;
    }
    case "cmo_costing":
      rows = batches.filter((row) => inRange(row) && text(row.customerId));
      break;
    case "incomplete_records":
      rows = batches.filter((row) => inRange(row) && text(row.completenessStatus) === "incomplete");
      break;
    case "pending_approvals": {
      const pending = await loadPendingCostingApprovals(idToken);
      rows = pending.rows;
      break;
    }
    case "ledger_reconciliation": {
      const recons = await queryMasterDocuments(COSTING_COLLECTIONS.reconciliations, idToken, { limit: 200 });
      rows = recons;
      break;
    }
    default:
      rows = batches.filter(inRange);
  }

  return { rows, nextCursor: null, meta };
}
