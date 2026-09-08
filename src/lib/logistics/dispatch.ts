import { LOGISTICS_COLLECTIONS } from "@/lib/logistics/collections";
import { isLogisticsResource, LOGISTICS_RESOURCES, type LogisticsResource } from "@/lib/logistics/http";
import { loadShipmentDetail, loadWarehouse360 } from "@/lib/logistics/query";
import {
  advanceLogisticsRecord,
  allocateInventory,
  approveCycleCount,
  completeMovement,
  confirmDelivery,
  confirmPacking,
  confirmPick,
  confirmPutaway,
  COUNT_TRANSITIONS,
  createComplianceCheck,
  createCustomerReturn,
  createCycleCount,
  createIncident,
  createMovement,
  createPacking,
  createPallet,
  createProvider,
  createPutaway,
  createReservation,
  createShipment,
  decideExcursion,
  dispatchShipment,
  EXCURSION_TRANSITIONS,
  MOVEMENT_TRANSITIONS,
  PACK_TRANSITIONS,
  PICK_TRANSITIONS,
  PUTAWAY_TRANSITIONS,
  receiveCustomerReturn,
  recordTemperature,
  RETURN_TRANSITIONS,
  SHIPMENT_TRANSITIONS,
} from "@/lib/logistics/server";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument } from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";

export function assertLogisticsResource(value: string): LogisticsResource {
  if (!isLogisticsResource(value)) throw createNamedError("ValidationError", "Unknown logistics resource.");
  return value;
}

export async function createLogisticsRecord(resource: LogisticsResource, payload: Record<string, unknown>, session: SessionPayload, idToken: string) {
  if (resource === "putaways") return createPutaway({ payload, session, idToken });
  if (resource === "movements") return createMovement({ payload, session, idToken });
  if (resource === "picks") return allocateInventory({ payload, session, idToken });
  if (resource === "packing") return createPacking({ payload, session, idToken });
  if (resource === "shipments") return createShipment({ payload, session, idToken });
  if (resource === "returns") return createCustomerReturn({ payload, session, idToken });
  if (resource === "reservations") return createReservation({ payload, session, idToken });
  if (resource === "cycleCounts") return createCycleCount({ payload, session, idToken });
  if (resource === "temperatures") return recordTemperature({ payload, session, idToken });
  if (resource === "incidents") return createIncident({ payload, session, idToken });
  if (resource === "checks") return createComplianceCheck({ payload, session, idToken });
  if (resource === "providers") return createProvider({ payload, session, idToken });
  if (resource === "pallets") return createPallet({ payload, session, idToken });
  throw createNamedError("ValidationError", "This logistics resource cannot be created directly.");
}

export async function loadLogisticsDetail(resource: LogisticsResource, id: string, idToken: string) {
  if (resource === "shipments") return loadShipmentDetail(id, idToken);
  if (resource === "providers" || resource === "putaways") {
    const record = await readMasterDocument(LOGISTICS_RESOURCES[resource].collection, id, idToken);
    return record ? { record, extra: {} } : null;
  }
  const record = await readMasterDocument(LOGISTICS_RESOURCES[resource].collection, id, idToken);
  if (!record) return null;
  return { record, extra: {} };
}

export async function runLogisticsAction(
  resource: LogisticsResource,
  id: string,
  action: string,
  payload: Record<string, unknown>,
  session: SessionPayload,
  idToken: string
) {
  const comment = String(payload.comment || payload.reason || "");
  if (resource === "putaways" && action === "confirm") return confirmPutaway({ id, session, idToken, comment });
  if (resource === "putaways") {
    return advanceLogisticsRecord({ collection: LOGISTICS_COLLECTIONS.putaways, id, next: action, map: PUTAWAY_TRANSITIONS, permission: "warehousePutaway:update", session, idToken, comment });
  }
  if (resource === "movements" && action === "complete") return completeMovement({ id, session, idToken, comment });
  if (resource === "movements") {
    return advanceLogisticsRecord({ collection: LOGISTICS_COLLECTIONS.movements, id, next: action, map: MOVEMENT_TRANSITIONS, permission: "inventory:update", session, idToken, comment });
  }
  if (resource === "picks" && action === "confirm") return confirmPick({ id, session, idToken, comment });
  if (resource === "picks") {
    return advanceLogisticsRecord({ collection: LOGISTICS_COLLECTIONS.picks, id, next: action, map: PICK_TRANSITIONS, permission: "warehousePicking:update", session, idToken, comment });
  }
  if (resource === "packing" && action === "confirm") return confirmPacking({ id, session, idToken, comment });
  if (resource === "packing") {
    return advanceLogisticsRecord({ collection: LOGISTICS_COLLECTIONS.packing, id, next: action, map: PACK_TRANSITIONS, permission: "warehousePacking:update", session, idToken, comment });
  }
  if (resource === "shipments" && action === "dispatch") return dispatchShipment({ id, session, idToken, comment });
  if (resource === "shipments" && action === "deliver") return confirmDelivery({ id, payload, session, idToken });
  if (resource === "shipments") {
    return advanceLogisticsRecord({ collection: LOGISTICS_COLLECTIONS.shipments, id, next: action, map: SHIPMENT_TRANSITIONS, permission: "warehouseShipment:update", session, idToken, comment });
  }
  if (resource === "returns" && action === "receive") return receiveCustomerReturn({ id, session, idToken, comment });
  if (resource === "returns") {
    return advanceLogisticsRecord({ collection: LOGISTICS_COLLECTIONS.returns, id, next: action, map: RETURN_TRANSITIONS, permission: action === "approved" || action === "approve" ? "warehouseCustomerReturn:approve" : "warehouseCustomerReturn:update", session, idToken, comment });
  }
  if (resource === "cycleCounts" && action === "approve") return approveCycleCount({ id, payload, session, idToken });
  if (resource === "cycleCounts") {
    return advanceLogisticsRecord({ collection: LOGISTICS_COLLECTIONS.cycleCounts, id, next: action, map: COUNT_TRANSITIONS, permission: "warehouseCycleCount:update", session, idToken, comment });
  }
  if (resource === "excursions" && action === "decide") return decideExcursion({ id, payload, session, idToken });
  if (resource === "excursions") {
    return advanceLogisticsRecord({ collection: LOGISTICS_COLLECTIONS.excursions, id, next: action, map: EXCURSION_TRANSITIONS, permission: "warehouseExcursion:update", session, idToken, comment });
  }
  throw createNamedError("ValidationError", "Unknown logistics action.");
}

export async function loadSite(id: string, idToken: string) {
  return loadWarehouse360(id, idToken);
}
