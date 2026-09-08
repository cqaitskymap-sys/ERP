import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";
import type { ProductionResource } from "@/lib/production/http";
import { listByField } from "@/lib/production/helpers";
import { loadApprovals } from "@/lib/production/approvals";
import { loadBatchDetail } from "@/lib/production/query";
import {
  actOnBmr,
  actOnBom,
  actOnDispensing,
  actOnManufacturingOrder,
  actOnProcessStep,
  actOnProductionPlan,
  assignResource,
  createBatchPlan,
  createBmr,
  createBom,
  createDeviation,
  createDispensingRequest,
  createEquipment,
  createManufacturingOrder,
  createProductionPlan,
  createProductionSchedule,
  createWorkCenter,
  recordIpc,
  recordReconciliation,
  recordWastage,
  recordYield,
  saveProcessTemplate,
  transitionSchedule,
} from "@/lib/production/server";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";

export async function createProductionRecord(
  resource: ProductionResource,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  if (resource === "plans") return createProductionPlan({ payload, session, idToken });
  if (resource === "schedules") return createProductionSchedule({ payload, session, idToken });
  if (resource === "batchPlans") return createBatchPlan({ payload, session, idToken });
  if (resource === "orders") return createManufacturingOrder({ payload, session, idToken });
  if (resource === "boms") return createBom({ payload, session, idToken });
  if (resource === "dispensing") return createDispensingRequest({ payload, session, idToken });
  if (resource === "workCenters") return createWorkCenter({ payload, session, idToken });
  if (resource === "equipment") return createEquipment({ payload, session, idToken });
  if (resource === "bmrs") return createBmr({ payload, session, idToken });
  if (resource === "ipc") return recordIpc({ payload, session, idToken });
  if (resource === "yields") return recordYield({ payload, session, idToken });
  if (resource === "reconciliations") return recordReconciliation({ payload, session, idToken });
  if (resource === "wastage") return recordWastage({ payload, session, idToken });
  if (resource === "deviations") return createDeviation({ payload, session, idToken });
  throw createNamedError("ValidationError", "This production resource cannot be created directly.");
}

export async function loadProductionDetail(resource: ProductionResource, id: string, idToken: string) {
  if (resource === "orders") return loadBatchDetail(id, idToken);
  const collection = PRODUCTION_RESOURCES_MAP[resource];
  const record = await readMasterDocument(collection, id, idToken);
  if (!record) return null;
  const extra: Record<string, unknown> = {};
  if (resource === "plans") extra.items = await listByField(PRODUCTION_COLLECTIONS.planItems, "productionPlanId", id, idToken);
  if (resource === "boms") extra.items = await listByField(PRODUCTION_COLLECTIONS.bomItems, "bomId", id, idToken);
  if (resource === "dispensing") extra.items = await listByField(PRODUCTION_COLLECTIONS.dispensingItems, "dispensingRequestId", id, idToken);
  if (resource === "bmrs") extra.steps = await listByField(PRODUCTION_COLLECTIONS.steps, "bmrId", id, idToken);
  if (["plans", "boms", "orders"].includes(resource)) {
    extra.approvals = await loadApprovals(resource === "plans" ? "productionPlan" : resource === "boms" ? "bom" : "manufacturingOrder", id, idToken);
  }
  return { record, extra };
}

const PRODUCTION_RESOURCES_MAP: Record<ProductionResource, string> = {
  plans: PRODUCTION_COLLECTIONS.plans,
  schedules: PRODUCTION_COLLECTIONS.schedules,
  batchPlans: PRODUCTION_COLLECTIONS.batchPlans,
  orders: PRODUCTION_COLLECTIONS.orders,
  boms: PRODUCTION_COLLECTIONS.boms,
  dispensing: PRODUCTION_COLLECTIONS.dispensing,
  workCenters: PRODUCTION_COLLECTIONS.workCenters,
  equipment: PRODUCTION_COLLECTIONS.equipment,
  bmrs: PRODUCTION_COLLECTIONS.bmrs,
  ipc: PRODUCTION_COLLECTIONS.ipc,
  yields: PRODUCTION_COLLECTIONS.yields,
  reconciliations: PRODUCTION_COLLECTIONS.reconciliations,
  wastage: PRODUCTION_COLLECTIONS.wastage,
  deviations: PRODUCTION_COLLECTIONS.deviations,
};

export async function runProductionAction(
  resource: ProductionResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  const comment = String(payload.comment || payload.reason || payload.remarks || "");
  if (resource === "plans" && ["submit", "approve", "reject", "return", "cancel"].includes(action)) {
    return actOnProductionPlan({ id, action: action as "submit" | "approve" | "reject" | "return" | "cancel", comment, session, idToken });
  }
  if (resource === "schedules") {
    return transitionSchedule({ id, action: action as "schedule" | "ready" | "start" | "pause" | "complete" | "cancel", session, idToken });
  }
  if (resource === "boms" && ["submit", "approve", "reject", "return", "activate"].includes(action)) {
    return actOnBom({ id, action: action as "submit" | "approve" | "reject" | "return" | "activate", comment, session, idToken });
  }
  if (resource === "orders") {
    return actOnManufacturingOrder({
      id,
      action: action as "submit" | "approve" | "reject" | "start" | "pause" | "resume" | "complete" | "cancel" | "send_qc",
      comment,
      session,
      idToken,
    });
  }
  if (resource === "dispensing") return actOnDispensing({ id, action: action as "approve" | "cancel", comment, session, idToken });
  if (resource === "bmrs" && ["start-step", "complete-step", "skip-step", "fail-step"].includes(action)) {
    return actOnProcessStep({
      id: String(payload.stepId || id),
      action: action.replace("-step", "") as "start" | "complete" | "skip" | "fail",
      remarks: comment,
      session,
      idToken,
    });
  }
  if (resource === "bmrs") return actOnBmr({ id, action: action as "start" | "pause" | "complete" | "review", session, idToken });
  if (action === "assign") return assignResource({ payload: { ...payload, manufacturingOrderId: id }, session, idToken });
  if (action === "template") return saveProcessTemplate({ payload, session, idToken });
  throw createNamedError("ValidationError", "Unknown production action.");
}

