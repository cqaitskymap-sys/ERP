import { queryMasterDocuments } from "@/lib/masters/firestore";
import { SALES_COLLECTIONS } from "@/lib/sales/collections";
import { text } from "@/lib/sales/helpers";
import type { SalesOrderBlocker } from "@/types/sales";

export async function loadActiveCustomerRequirements(
  customerId: string,
  idToken: string,
  productId?: string
) {
  const rows = await queryMasterDocuments(SALES_COLLECTIONS.requirements, idToken, {
    filters: [
      { field: "customerId", value: customerId },
      { field: "status", value: "active" },
    ],
    limit: 100,
  });
  return rows.filter((row) => {
    const linkedProduct = text(row.productId);
    if (!linkedProduct) return true;
    if (!productId) return true;
    return linkedProduct === productId;
  });
}

export async function validateCustomerRequirements(options: {
  customerId: string;
  productIds: string[];
  idToken: string;
}): Promise<{ ok: boolean; blockers: SalesOrderBlocker[]; warnings: string[]; requirements: Array<Record<string, unknown>> }> {
  const all = await loadActiveCustomerRequirements(options.customerId, options.idToken);
  const relevant = all.filter((row) => {
    const productId = text(row.productId);
    return !productId || options.productIds.includes(productId);
  });
  const blockers: SalesOrderBlocker[] = [];
  const warnings: string[] = [];

  for (const req of relevant) {
    if (req.affectsManufacturing || req.affectsQuality || req.affectsRegulatory) {
      if (text(req.controlledWorkflowStatus) && text(req.controlledWorkflowStatus) !== "approved") {
        blockers.push({
          code: "controlled_requirement_pending",
          label: `Controlled requirement "${text(req.title)}" is pending ${text(req.controlledWorkflowStatus) || "approval"}.`,
          severity: "blocking",
        });
      } else if (!text(req.controlledWorkflowStatus)) {
        warnings.push(
          `Requirement "${text(req.title)}" affects controlled processes and must be routed through the appropriate workflow before production authorization.`
        );
      }
    }
    if (text(req.category) === "minimum_shelf_life" && !text(req.description)) {
      warnings.push("Minimum shelf-life requirement is active but has no measurable description.");
    }
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    requirements: relevant,
  };
}

export function extractMinShelfLifeMonths(requirements: Array<Record<string, unknown>>, customer?: Record<string, unknown> | null) {
  if (customer?.minShelfLifeMonths != null) return Number(customer.minShelfLifeMonths) || 0;
  const shelf = requirements.find((row) => text(row.category) === "minimum_shelf_life");
  if (!shelf) return 0;
  const match = text(shelf.description).match(/(\d+)\s*(month|months|mo)/i);
  return match ? Number(match[1]) : 0;
}
