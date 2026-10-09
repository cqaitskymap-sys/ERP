import { COSTING_COLLECTIONS } from "@/lib/costing/collections";
import { isCostingResource, type CostingResource } from "@/lib/costing/http";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import {
  calculateCustomerProfitability,
  calculateProductProfitability,
  calculateProductStandardCostRecord,
  createAllocationRule,
  createBatchCostingRecord,
  createCostVarianceInvestigation,
  createRateCard,
  loadBatchCostingExtras,
  recalculateBatchCosting,
  reconcileCostingToLedger,
  saveCostingSettings,
  transitionBatchCosting,
  transitionProductStandard,
} from "@/lib/costing/server";
import type { SessionPayload } from "@/types/auth";

const COLLECTION_MAP: Record<CostingResource, string> = {
  standards: COSTING_COLLECTIONS.productStandards,
  batches: COSTING_COLLECTIONS.batchRecords,
  rateCards: COSTING_COLLECTIONS.rateCards,
  allocationRules: COSTING_COLLECTIONS.allocationRules,
  variances: COSTING_COLLECTIONS.varianceAnalyses,
  investigations: COSTING_COLLECTIONS.varianceInvestigations,
  reconciliations: COSTING_COLLECTIONS.reconciliations,
  settings: COSTING_COLLECTIONS.settings,
};

export async function createCostingRecord(
  resource: CostingResource,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  if (resource === "standards") return calculateProductStandardCostRecord({ payload, session, idToken });
  if (resource === "batches") return createBatchCostingRecord({ payload, session, idToken });
  if (resource === "rateCards") return createRateCard({ payload, session, idToken });
  if (resource === "allocationRules") return createAllocationRule({ payload, session, idToken });
  if (resource === "investigations") return createCostVarianceInvestigation({ payload, session, idToken });
  if (resource === "settings") return saveCostingSettings({ payload, session, idToken });
  throw createNamedError("ValidationError", "This costing resource cannot be created directly.");
}

export async function loadCostingDetail(
  resource: CostingResource,
  id: string,
  idToken: string,
  _session: SessionPayload
) {
  const record = await readMasterDocument(COLLECTION_MAP[resource], id, idToken);
  if (!record) return null;
  const extra: Record<string, unknown> = {};
  if (resource === "batches") {
    Object.assign(extra, await loadBatchCostingExtras(id, idToken));
  }
  if (resource === "standards") {
    const { listByField } = await import("@/lib/costing/helpers");
    extra.versions = await listByField(COSTING_COLLECTIONS.standardVersions, "standardId", id, idToken);
  }
  return { record, extra };
}

export async function runCostingAction(
  resource: CostingResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  const comment = String(payload.comment || payload.reason || "");
  if (resource === "standards" && ["submit", "approve", "reject", "finalize", "reopen"].includes(action)) {
    return transitionProductStandard({
      id,
      action: action as "submit" | "approve" | "reject" | "finalize" | "reopen",
      comment,
      session,
      idToken,
    });
  }
  if (resource === "batches") {
    if (action === "recalculate") return recalculateBatchCosting({ id, session, idToken });
    if (action === "reconcile") return reconcileCostingToLedger({ id, session, idToken });
    if (["submit", "approve", "reject", "finalize", "reopen"].includes(action)) {
      return transitionBatchCosting({
        id,
        action: action as "submit" | "approve" | "reject" | "finalize" | "reopen",
        comment,
        varianceExplanation: String(payload.varianceExplanation || ""),
        session,
        idToken,
      });
    }
  }
  if (resource === "batches" && action === "profitability_product" && payload.productId) {
    return calculateProductProfitability({
      productId: String(payload.productId),
      idToken,
      session,
    });
  }
  if (resource === "batches" && action === "profitability_customer" && payload.customerId) {
    return calculateCustomerProfitability({
      customerId: String(payload.customerId),
      idToken,
      session,
    });
  }
  if (!isCostingResource(resource)) throw createNamedError("ValidationError", "Unknown costing resource.");
  throw createNamedError("ValidationError", `Unsupported action "${action}" for ${resource}.`);
}
