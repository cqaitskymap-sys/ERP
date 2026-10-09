import { queryMasterDocuments, readMasterDocument } from "@/lib/masters/firestore";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";
import { PROCUREMENT_COLLECTIONS } from "@/lib/procurement/collections";
import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import { COSTING_COLLECTIONS } from "@/lib/costing/collections";
import { money } from "@/lib/finance/money";
import { text } from "@/lib/costing/helpers";
import type { CostDataQuality } from "@/types/costing";

export interface MaterialUnitCostResult {
  unitCost: number;
  valuationBasis: string;
  dataQuality: CostDataQuality;
  sourceCollection?: string;
  sourceId?: string;
  currency: string;
}

/** Resolve material unit cost without inventing values. Prefer PO price, then standard rate card. */
export async function resolveMaterialUnitCost(
  materialId: string,
  idToken: string,
  options?: { preferStandard?: boolean }
): Promise<MaterialUnitCostResult> {
  if (!materialId) {
    return {
      unitCost: 0,
      valuationBasis: "unavailable",
      dataQuality: "missing",
      currency: "INR",
    };
  }

  if (!options?.preferStandard) {
    const poItems = await queryMasterDocuments(PROCUREMENT_COLLECTIONS.orderItems, idToken, {
      filters: [{ field: "materialId", value: materialId }],
      orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
      limit: 5,
    });
    const priced = poItems.find((row) => money(row.unitPrice) > 0);
    if (priced) {
      return {
        unitCost: money(priced.unitPrice),
        valuationBasis: "purchase_order_unit_price",
        dataQuality: "actual",
        sourceCollection: PROCUREMENT_COLLECTIONS.orderItems,
        sourceId: String(priced.id),
        currency: text(priced.currency) || "INR",
      };
    }
  }

  const rates = await queryMasterDocuments(COSTING_COLLECTIONS.rateCards, idToken, {
    filters: [
      { field: "rateType", value: "material_standard" },
      { field: "referenceId", value: materialId },
      { field: "status", value: "active" },
    ],
    limit: 5,
  });
  const rate = rates[0];
  if (rate && money(rate.rate) > 0) {
    return {
      unitCost: money(rate.rate),
      valuationBasis: "standard_rate_card",
      dataQuality: "standard",
      sourceCollection: COSTING_COLLECTIONS.rateCards,
      sourceId: String(rate.id),
      currency: text(rate.currency) || "INR",
    };
  }

  return {
    unitCost: 0,
    valuationBasis: "unavailable",
    dataQuality: "missing",
    currency: "INR",
  };
}

export async function loadApprovedBom(bomId: string, idToken: string) {
  const bom = await readMasterDocument(PRODUCTION_COLLECTIONS.boms, bomId, idToken);
  if (!bom) return null;
  const items = await queryMasterDocuments(PRODUCTION_COLLECTIONS.bomItems, idToken, {
    filters: [{ field: "bomId", value: bomId }],
    limit: 200,
  });
  return { bom, items };
}

export async function loadManufacturingOrderContext(manufacturingOrderId: string, idToken: string) {
  const order = await readMasterDocument(PRODUCTION_COLLECTIONS.orders, manufacturingOrderId, idToken);
  if (!order) return null;

  const [dispensing, yields, reconciliations, wastage, bmrs, issues] = await Promise.all([
    queryMasterDocuments(PRODUCTION_COLLECTIONS.dispensing, idToken, {
      filters: [{ field: "manufacturingOrderId", value: manufacturingOrderId }],
      limit: 50,
    }),
    queryMasterDocuments(PRODUCTION_COLLECTIONS.yields, idToken, {
      filters: [{ field: "manufacturingOrderId", value: manufacturingOrderId }],
      limit: 50,
    }),
    queryMasterDocuments(PRODUCTION_COLLECTIONS.reconciliations, idToken, {
      filters: [{ field: "manufacturingOrderId", value: manufacturingOrderId }],
      limit: 100,
    }),
    queryMasterDocuments(PRODUCTION_COLLECTIONS.wastage, idToken, {
      filters: [{ field: "manufacturingOrderId", value: manufacturingOrderId }],
      limit: 100,
    }),
    queryMasterDocuments(PRODUCTION_COLLECTIONS.bmrs, idToken, {
      filters: [{ field: "manufacturingOrderId", value: manufacturingOrderId }],
      limit: 20,
    }),
    queryMasterDocuments(INVENTORY_COLLECTIONS.issues, idToken, {
      filters: [{ field: "referenceId", value: manufacturingOrderId }],
      limit: 50,
    }).catch(() => []),
  ]);

  const dispensingIds = dispensing.map((row) => String(row.id));
  const dispensingItems = [];
  for (const id of dispensingIds.slice(0, 20)) {
    const items = await queryMasterDocuments(PRODUCTION_COLLECTIONS.dispensingItems, idToken, {
      filters: [{ field: "dispensingRequestId", value: id }],
      limit: 100,
    });
    dispensingItems.push(...items);
  }

  const issueItems: Array<Record<string, unknown> & { id: string; issueId: string }> = [];
  for (const issue of issues.slice(0, 20)) {
    const items = await queryMasterDocuments(INVENTORY_COLLECTIONS.issueItems, idToken, {
      filters: [{ field: "stockIssueId", value: String(issue.id) }],
      limit: 100,
    }).catch(() => []);
    issueItems.push(
      ...items.map((item) => ({
        ...(item as Record<string, unknown>),
        id: String(item.id),
        issueId: String(issue.id),
      }))
    );
  }

  return {
    order,
    dispensing,
    dispensingItems,
    yields,
    reconciliations,
    wastage,
    bmrs,
    issues,
    issueItems,
  };
}

export function isPackagingMaterial(materialStage: unknown, materialCategory: unknown) {
  const stage = text(materialStage).toLowerCase();
  const category = text(materialCategory).toLowerCase();
  return (
    stage.includes("pack") ||
    category.includes("pack") ||
    stage === "packaging" ||
    category === "packaging_material"
  );
}
