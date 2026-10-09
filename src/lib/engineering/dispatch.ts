import { ENGINEERING_COLLECTIONS } from "@/lib/engineering/collections";
import { isEngineeringResource, type EngineeringResource } from "@/lib/engineering/http";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import {
  assessEquipmentCriticalityRecord,
  completeMaintenanceTask,
  createChecklist,
  createEquipmentRecord,
  createMaintenancePlan,
  createMaintenanceWorkOrder,
  createSpareLink,
  generateMaintenanceTasks,
  reportEquipmentBreakdown,
  reserveMaintenanceSpareParts,
  saveEngineeringSettings,
  transitionBreakdown,
  transitionEquipmentStatus,
  transitionWorkOrder,
} from "@/lib/engineering/server";
import {
  acknowledgeUtilityAlert,
  createCalibrationRecord,
  createInstrumentRecord,
  createQualificationRecord,
  createUtilitySystem,
  evaluateCalibrationResultsRecord,
  loadCalibrationExtras,
  loadWorkOrderExtras,
  recordUtilityMeasurement,
  reviewCalibration,
  transitionCalibration,
  transitionQualification,
} from "@/lib/engineering/server-ops";
import type { SessionPayload } from "@/types/auth";

const COLLECTION_MAP: Record<EngineeringResource, string> = {
  equipment: ENGINEERING_COLLECTIONS.equipment,
  riskAssessments: ENGINEERING_COLLECTIONS.riskAssessments,
  maintenancePlans: ENGINEERING_COLLECTIONS.maintenancePlans,
  maintenanceTasks: ENGINEERING_COLLECTIONS.maintenanceTasks,
  workOrders: ENGINEERING_COLLECTIONS.workOrders,
  breakdowns: ENGINEERING_COLLECTIONS.breakdowns,
  instruments: ENGINEERING_COLLECTIONS.instruments,
  calibrations: ENGINEERING_COLLECTIONS.calibrationRecords,
  qualifications: ENGINEERING_COLLECTIONS.qualifications,
  checklists: ENGINEERING_COLLECTIONS.checklists,
  utilitySystems: ENGINEERING_COLLECTIONS.utilitySystems,
  monitoring: ENGINEERING_COLLECTIONS.monitoringRecords,
  utilityAlerts: ENGINEERING_COLLECTIONS.utilityAlerts,
  spareParts: ENGINEERING_COLLECTIONS.spareLinks,
  documents: ENGINEERING_COLLECTIONS.documents,
  settings: ENGINEERING_COLLECTIONS.settings,
};

export async function createEngineeringRecord(
  resource: EngineeringResource,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  if (resource === "equipment") return createEquipmentRecord({ payload, session, idToken });
  if (resource === "riskAssessments") return assessEquipmentCriticalityRecord({ payload, session, idToken });
  if (resource === "maintenancePlans") return createMaintenancePlan({ payload, session, idToken });
  if (resource === "workOrders") return createMaintenanceWorkOrder({ payload, session, idToken });
  if (resource === "breakdowns") return reportEquipmentBreakdown({ payload, session, idToken });
  if (resource === "instruments") return createInstrumentRecord({ payload, session, idToken });
  if (resource === "calibrations") return createCalibrationRecord({ payload, session, idToken });
  if (resource === "qualifications") return createQualificationRecord({ payload, session, idToken });
  if (resource === "checklists") return createChecklist({ payload, session, idToken });
  if (resource === "utilitySystems") return createUtilitySystem({ payload, session, idToken });
  if (resource === "monitoring") return recordUtilityMeasurement({ payload, session, idToken });
  if (resource === "spareParts") return createSpareLink({ payload, session, idToken });
  if (resource === "settings") return saveEngineeringSettings({ payload, session, idToken });
  throw createNamedError("ValidationError", "This engineering resource cannot be created directly.");
}

export async function loadEngineeringDetail(
  resource: EngineeringResource,
  id: string,
  idToken: string,
  _session: SessionPayload
) {
  const record = await readMasterDocument(COLLECTION_MAP[resource], id, idToken);
  if (!record) return null;
  const extra: Record<string, unknown> = {};
  if (resource === "workOrders") Object.assign(extra, await loadWorkOrderExtras(id, idToken));
  if (resource === "calibrations") Object.assign(extra, await loadCalibrationExtras(id, idToken));
  if (resource === "equipment") {
    const { listByField } = await import("@/lib/engineering/helpers");
    extra.riskAssessments = await listByField(ENGINEERING_COLLECTIONS.riskAssessments, "equipmentId", id, idToken);
    extra.workOrders = await listByField(ENGINEERING_COLLECTIONS.workOrders, "equipmentId", id, idToken);
  }
  return { record, extra };
}

export async function runEngineeringAction(
  resource: EngineeringResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  const comment = String(payload.comment || payload.reason || "");
  if (resource === "equipment" && action === "transition" && payload.toStatus) {
    return transitionEquipmentStatus({
      id,
      toStatus: String(payload.toStatus),
      reason: comment,
      session,
      idToken,
    });
  }
  if (resource === "maintenancePlans" && action === "generate_tasks") {
    return generateMaintenanceTasks({ planId: id, horizonDays: Number(payload.horizonDays || 30), session, idToken });
  }
  if (resource === "maintenanceTasks" && action === "complete") {
    return completeMaintenanceTask({ id, payload, session, idToken });
  }
  if (resource === "maintenanceTasks" && action === "generate_all") {
    return generateMaintenanceTasks({ horizonDays: Number(payload.horizonDays || 30), session, idToken });
  }
  if (resource === "workOrders") {
    if (action === "reserve_spares") return reserveMaintenanceSpareParts({ workOrderId: id, session, idToken });
    return transitionWorkOrder({ id, action, comment, payload, session, idToken });
  }
  if (resource === "breakdowns") {
    return transitionBreakdown({ id, action, comment, payload, session, idToken });
  }
  if (resource === "calibrations") {
    if (action === "submit_results") {
      return evaluateCalibrationResultsRecord({ id, payload, session, idToken });
    }
    if (["pass", "fail", "oot", "close"].includes(action)) {
      return reviewCalibration({
        id,
        action: action as "pass" | "fail" | "oot" | "close",
        comment,
        session,
        idToken,
      });
    }
    return transitionCalibration({ id, action, comment, session, idToken });
  }
  if (resource === "qualifications") {
    return transitionQualification({ id, action, comment, session, idToken });
  }
  if (resource === "utilityAlerts" && action === "acknowledge") {
    return acknowledgeUtilityAlert({
      id,
      comment,
      deviationId: payload.deviationId ? String(payload.deviationId) : undefined,
      session,
      idToken,
    });
  }
  if (!isEngineeringResource(resource)) throw createNamedError("ValidationError", "Unknown engineering resource.");
  throw createNamedError("ValidationError", `Unsupported action "${action}" for ${resource}.`);
}
