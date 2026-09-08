import { searchIndex } from "@/lib/inventory/keys";
import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import {
  applyBalanceDelta,
  applyReservationDelta,
  applyReservedConsumption,
  commitWithRetry,
  createLedgerWrite,
  requireLocation,
  resolveItem,
  type StockSnapshot,
} from "@/lib/inventory/engine";
import { isInventoryExpired } from "@/lib/inventory/expiry";
import { queryMasterDocuments, readMasterDocument } from "@/lib/masters/firestore";
import { LOGISTICS_COLLECTIONS } from "@/lib/logistics/collections";
import {
  actorStamp,
  auditLogistics,
  commitWrites,
  electronicSignature,
  ensurePermission,
  fail,
  idempotencyWrite,
  issueLogisticsNumber,
  notifyLogistics,
  parseOrFail,
  preventSelfApproval,
  requireRecord,
  reuseIdempotent,
  text,
  writeOf,
} from "@/lib/logistics/helpers";
import {
  calculateInventoryVariance,
  detectTemperatureExcursion,
  selectFEFOInventory,
  validateShelfLife,
} from "@/lib/logistics/scoring";
import {
  COUNT_TRANSITIONS,
  EXCURSION_TRANSITIONS,
  MOVEMENT_TRANSITIONS,
  PACK_TRANSITIONS,
  PICK_TRANSITIONS,
  PUTAWAY_TRANSITIONS,
  RETURN_TRANSITIONS,
  SHIPMENT_TRANSITIONS,
  canTransition,
} from "@/lib/logistics/status";
import {
  complianceSchema,
  customerReturnSchema,
  cycleCountSchema,
  excursionDecisionSchema,
  incidentSchema,
  movementSchema,
  packingSchema,
  palletSchema,
  pickSchema,
  providerSchema,
  putawaySchema,
  reservationSchema,
  shipmentSchema,
  temperatureSchema,
} from "@/lib/validation/logistics";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";
import type { FefoCandidate } from "@/types/inventory";

function snapshotFrom(item: Awaited<ReturnType<typeof resolveItem>>, extra: {
  batchNumber: string;
  warehouseId: string;
  locationId: string;
  qualityStatus?: string;
  expiryDate?: string;
  uom?: string;
}): StockSnapshot {
  return {
    itemType: item.itemType,
    itemId: item.itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    materialId: item.materialId,
    productId: item.productId,
    batchNumber: extra.batchNumber,
    warehouseId: extra.warehouseId,
    locationId: extra.locationId,
    qualityStatus: extra.qualityStatus || "approved",
    uom: extra.uom || item.uom,
    expiryDate: extra.expiryDate,
  };
}

async function loadIssuableBalances(itemId: string, warehouseId: string, idToken: string): Promise<FefoCandidate[]> {
  const rows = await queryMasterDocuments(INVENTORY_COLLECTIONS.balances, idToken, {
    filters: [
      { field: "itemId", value: itemId },
      { field: "warehouseId", value: warehouseId },
      { field: "qualityStatus", value: "approved" },
    ],
    limit: 80,
  });
  return rows.map((row) => ({
    id: row.id,
    inventoryBatchId: text(row.inventoryBatchId),
    itemId: text(row.itemId),
    itemType: text(row.itemType),
    batchNumber: text(row.batchNumber),
    lotNumber: text(row.lotNumber),
    warehouseId: text(row.warehouseId),
    locationId: text(row.locationId),
    qualityStatus: text(row.qualityStatus),
    inventoryStatus: text(row.inventoryStatus),
    availableQuantity: Number(row.availableQuantity || 0),
    expiryDate: text(row.expiryDate) || null,
    uom: text(row.uom),
  }));
}

export async function createPutaway(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "warehousePutaway:create");
  const data = parseOrFail(putawaySchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireLocation(data.warehouseId, data.locationId, options.idToken);
  const numbered = await issueLogisticsNumber("PUT", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    putawayId: id,
    putawayNumber: numbered.documentNumber,
    ...data,
    status: "created",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.batchNumber, data.warehouseId),
  };
  const writes = [writeOf(LOGISTICS_COLLECTIONS.putaways, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "PUTAWAY_CREATED",
    resource: LOGISTICS_COLLECTIONS.putaways,
    resourceId: id,
    description: `Created put away ${numbered.documentNumber}.`,
  });
  await notifyLogistics(options.idToken, options.session, {
    type: "putaway_pending",
    title: "Put away pending",
    message: `${numbered.documentNumber} is waiting for confirmation.`,
    resource: LOGISTICS_COLLECTIONS.putaways,
    resourceId: id,
    audienceRoles: ["warehouse", "qa"],
  });
  return { id, record };
}

export async function confirmPutaway(options: { id: string; session: SessionPayload; idToken: string; comment?: string }) {
  ensurePermission(options.session, "warehousePutaway:confirm");
  const current = await requireRecord(LOGISTICS_COLLECTIONS.putaways, options.id, options.idToken, "Put away");
  if (!canTransition(PUTAWAY_TRANSITIONS, text(current.status), "confirmed") && text(current.status) !== "created" && text(current.status) !== "in_progress" && text(current.status) !== "assigned") {
    fail(`Cannot confirm put away in "${current.status}" status.`);
  }
  const item = await resolveItem({
    itemType: text(current.itemType),
    materialId: text(current.materialId),
    productId: text(current.productId),
    idToken: options.idToken,
  });
  const dest = snapshotFrom(item, {
    batchNumber: text(current.batchNumber),
    warehouseId: text(current.warehouseId),
    locationId: text(current.locationId),
    qualityStatus: "approved",
  });
  const qty = Number(current.quantity);
  const writes = [];
  if (text(current.sourceLocationId)) {
    const source = snapshotFrom(item, {
      batchNumber: text(current.batchNumber),
      warehouseId: text(current.warehouseId),
      locationId: text(current.sourceLocationId),
      qualityStatus: "approved",
    });
    const out = await applyBalanceDelta({ snapshot: source, delta: -qty, session: options.session, idToken: options.idToken });
    writes.push(out.write);
    writes.push((await createLedgerWrite({
      draft: { type: "PUTAWAY", quantityIn: 0, quantityOut: qty, balanceAfter: Number(out.record.availableQuantity), referenceType: "putaway", referenceId: options.id, snapshot: source },
      session: options.session,
      idToken: options.idToken,
    })).write);
  }
  const into = await applyBalanceDelta({ snapshot: dest, delta: qty, session: options.session, idToken: options.idToken });
  writes.push(into.write);
  writes.push((await createLedgerWrite({
    draft: { type: "PUTAWAY", quantityIn: qty, quantityOut: 0, balanceAfter: Number(into.record.availableQuantity), referenceType: "putaway", referenceId: options.id, snapshot: dest },
    session: options.session,
    idToken: options.idToken,
  })).write);
  const next = { ...current, status: "confirmed", confirmationSignature: electronicSignature(options.session, "confirm_putaway", options.comment), ...actorStamp(options.session, current) };
  writes.push(writeOf(LOGISTICS_COLLECTIONS.putaways, options.id, next));
  await commitWithRetry(writes, options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "INVENTORY_PUT_AWAY",
    resource: LOGISTICS_COLLECTIONS.putaways,
    resourceId: options.id,
    description: `Confirmed put away ${current.putawayNumber}.`,
  });
  return { id: options.id, record: next };
}

export async function createMovement(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "inventory:update");
  const data = parseOrFail(movementSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireLocation(data.sourceWarehouseId, data.sourceLocationId, options.idToken);
  await requireLocation(data.destinationWarehouseId, data.destinationLocationId, options.idToken);
  const numbered = await issueLogisticsNumber("MOV", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    movementId: id,
    movementNumber: numbered.documentNumber,
    ...data,
    status: "draft",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.batchNumber, data.movementType),
  };
  const writes = [writeOf(LOGISTICS_COLLECTIONS.movements, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "STOCK_MOVEMENT_CREATED",
    resource: LOGISTICS_COLLECTIONS.movements,
    resourceId: id,
    description: `Created movement ${numbered.documentNumber}.`,
  });
  return { id, record };
}

export async function completeMovement(options: { id: string; session: SessionPayload; idToken: string; comment?: string }) {
  ensurePermission(options.session, "inventory:update");
  const current = await requireRecord(LOGISTICS_COLLECTIONS.movements, options.id, options.idToken, "Movement");
  if (["completed", "cancelled"].includes(text(current.status))) fail("This movement is already closed.");
  const item = await resolveItem({
    itemType: text(current.itemType),
    materialId: text(current.materialId),
    productId: text(current.productId),
    idToken: options.idToken,
  });
  const qty = Number(current.quantity);
  const source = snapshotFrom(item, {
    batchNumber: text(current.batchNumber),
    warehouseId: text(current.sourceWarehouseId),
    locationId: text(current.sourceLocationId),
  });
  const dest = snapshotFrom(item, {
    batchNumber: text(current.batchNumber),
    warehouseId: text(current.destinationWarehouseId),
    locationId: text(current.destinationLocationId),
  });
  const out = await applyBalanceDelta({ snapshot: source, delta: -qty, session: options.session, idToken: options.idToken });
  const into = await applyBalanceDelta({ snapshot: dest, delta: qty, session: options.session, idToken: options.idToken });
  const writes = [
    out.write,
    into.write,
    (await createLedgerWrite({
      draft: { type: "TRANSFER_OUT", quantityIn: 0, quantityOut: qty, balanceAfter: Number(out.record.availableQuantity), referenceType: "movement", referenceId: options.id, snapshot: source, remarks: text(current.reason) },
      session: options.session,
      idToken: options.idToken,
    })).write,
    (await createLedgerWrite({
      draft: { type: "TRANSFER_IN", quantityIn: qty, quantityOut: 0, balanceAfter: Number(into.record.availableQuantity), referenceType: "movement", referenceId: options.id, snapshot: dest, remarks: text(current.reason) },
      session: options.session,
      idToken: options.idToken,
    })).write,
    writeOf(LOGISTICS_COLLECTIONS.movements, options.id, { ...current, status: "completed", ...actorStamp(options.session, current) }),
  ];
  await commitWithRetry(writes, options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "INVENTORY_MOVED",
    resource: LOGISTICS_COLLECTIONS.movements,
    resourceId: options.id,
    description: `Completed ${current.movementNumber}.`,
  });
  return { id: options.id, record: { ...current, status: "completed" } };
}

export async function createReservation(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "inventory:update");
  const data = parseOrFail(reservationSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const item = await resolveItem({ itemType: data.itemType, materialId: data.materialId, productId: data.productId, idToken: options.idToken });
  const snapshot = snapshotFrom(item, { batchNumber: data.batchNumber, warehouseId: data.warehouseId, locationId: data.locationId });
  const reserved = await applyReservationDelta({ snapshot, reservedDelta: data.quantity, session: options.session, idToken: options.idToken });
  const id = crypto.randomUUID();
  const record = {
    reservationId: id,
    ...data,
    status: "reserved",
    ...actorStamp(options.session),
    searchIndex: searchIndex(data.batchNumber, data.orderId, data.customerId),
  };
  const writes = [
    reserved.write,
    (await createLedgerWrite({
      draft: { type: "RESERVE", quantityIn: 0, quantityOut: data.quantity, balanceAfter: Number(reserved.record.availableQuantity), referenceType: "reservation", referenceId: id, snapshot },
      session: options.session,
      idToken: options.idToken,
    })).write,
    writeOf(LOGISTICS_COLLECTIONS.reservations, id, record, { exists: false }),
  ];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWithRetry(writes, options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "INVENTORY_RESERVED",
    resource: LOGISTICS_COLLECTIONS.reservations,
    resourceId: id,
    description: `Reserved ${data.quantity} of ${data.batchNumber}.`,
  });
  return { id, record };
}

export async function allocateInventory(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "warehousePicking:create");
  const data = parseOrFail(pickSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const customer = data.customerId ? await readMasterDocument("customers", data.customerId, options.idToken) : null;
  const minMonths = Number(data.minShelfLifeMonths || customer?.minShelfLifeMonths || 0);
  const candidates = await loadIssuableBalances(data.productId, data.warehouseId, options.idToken);
  const selection = selectFEFOInventory(candidates, data.quantity, {
    warehouseId: data.warehouseId,
    minRemainingDays: minMonths ? minMonths * 30 : undefined,
  });
  if (selection.remainingQuantity > 0) fail("Insufficient eligible released inventory for FEFO allocation.");
  for (const allocation of selection.allocations) {
    const shelf = validateShelfLife(allocation.expiryDate, minMonths);
    if (!shelf.allowed) fail("Selected batch does not meet the customer minimum remaining shelf life.");
    if (isInventoryExpired(allocation.expiryDate)) fail("Expired stock cannot be allocated.");
  }
  const numbered = await issueLogisticsNumber("PICK", options.session, options.idToken);
  const id = crypto.randomUUID();
  const writes = [];
  const allocationIds: string[] = [];
  for (const allocation of selection.allocations) {
    const item = await resolveItem({ itemType: allocation.itemType, productId: allocation.itemId, materialId: allocation.itemType === "material" ? allocation.itemId : "", idToken: options.idToken });
    const snapshot = snapshotFrom(item, {
      batchNumber: allocation.batchNumber,
      warehouseId: allocation.warehouseId,
      locationId: allocation.locationId,
      expiryDate: allocation.expiryDate || undefined,
    });
    const reserved = await applyReservationDelta({ snapshot, reservedDelta: allocation.allocatedQuantity, session: options.session, idToken: options.idToken });
    writes.push(reserved.write);
    writes.push((await createLedgerWrite({
      draft: { type: "RESERVE", quantityIn: 0, quantityOut: allocation.allocatedQuantity, balanceAfter: Number(reserved.record.availableQuantity), referenceType: "pick", referenceId: id, snapshot },
      session: options.session,
      idToken: options.idToken,
    })).write);
    const allocationId = crypto.randomUUID();
    allocationIds.push(allocationId);
    writes.push(writeOf(LOGISTICS_COLLECTIONS.allocations, allocationId, {
      allocationId,
      pickId: id,
      ...allocation,
      quantity: allocation.allocatedQuantity,
      status: "allocated",
      ...actorStamp(options.session),
    }, { exists: false }));
    writes.push(writeOf(LOGISTICS_COLLECTIONS.pickItems, allocationId, {
      pickItemId: allocationId,
      pickId: id,
      ...allocation,
      quantity: allocation.allocatedQuantity,
      status: "allocated",
      ...actorStamp(options.session),
    }, { exists: false }));
  }
  const record = {
    pickId: id,
    pickNumber: numbered.documentNumber,
    ...data,
    minShelfLifeMonths: minMonths,
    allocationIds,
    status: "created",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.customerId, data.productId, data.orderId),
  };
  writes.push(writeOf(LOGISTICS_COLLECTIONS.picks, id, record, { exists: false }));
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWithRetry(writes, options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "INVENTORY_ALLOCATED",
    resource: LOGISTICS_COLLECTIONS.picks,
    resourceId: id,
    description: `Allocated FEFO inventory for ${numbered.documentNumber}.`,
  });
  await notifyLogistics(options.idToken, options.session, {
    type: "picking_pending",
    title: "Picking pending",
    message: `${numbered.documentNumber} is ready for assignment.`,
    resource: LOGISTICS_COLLECTIONS.picks,
    resourceId: id,
    audienceRoles: ["warehouse"],
  });
  return { id, record };
}

export async function confirmPick(options: { id: string; session: SessionPayload; idToken: string; comment?: string }) {
  ensurePermission(options.session, "warehousePicking:confirm");
  const current = await requireRecord(LOGISTICS_COLLECTIONS.picks, options.id, options.idToken, "Pick");
  if (text(current.status) === "verified") fail("This pick is already verified.");
  if (text(current.status) === "cancelled") fail("Cancelled picks cannot be confirmed.");
  const next = {
    ...current,
    status: "verified",
    confirmationSignature: electronicSignature(options.session, "confirm_pick", options.comment),
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(LOGISTICS_COLLECTIONS.picks, options.id, next)], options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "INVENTORY_PICKED",
    resource: LOGISTICS_COLLECTIONS.picks,
    resourceId: options.id,
    description: `Verified pick ${current.pickNumber}.`,
  });
  return { id: options.id, record: next };
}

export async function createPacking(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "warehousePacking:create");
  const data = parseOrFail(packingSchema, options.payload);
  const pick = await requireRecord(LOGISTICS_COLLECTIONS.picks, data.pickId, options.idToken, "Pick");
  if (!["picked", "verified"].includes(text(pick.status))) fail("Packing requires a picked or verified pick list.");
  const numbered = await issueLogisticsNumber("PACK", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    packingId: id,
    packingNumber: numbered.documentNumber,
    ...data,
    customerId: pick.customerId,
    warehouseId: pick.warehouseId,
    status: "created",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.pickId),
  };
  await commitWrites([writeOf(LOGISTICS_COLLECTIONS.packing, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function confirmPacking(options: { id: string; session: SessionPayload; idToken: string; comment?: string }) {
  ensurePermission(options.session, "warehousePacking:confirm");
  const current = await requireRecord(LOGISTICS_COLLECTIONS.packing, options.id, options.idToken, "Packing");
  if (text(current.status) === "complete") fail("This packing record is already complete.");
  const next = { ...current, status: "complete", confirmationSignature: electronicSignature(options.session, "confirm_pack", options.comment), ...actorStamp(options.session, current) };
  await commitWrites([writeOf(LOGISTICS_COLLECTIONS.packing, options.id, next)], options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "INVENTORY_PACKED",
    resource: LOGISTICS_COLLECTIONS.packing,
    resourceId: options.id,
    description: `Completed packing ${current.packingNumber}.`,
  });
  return { id: options.id, record: next };
}

export async function createShipment(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "warehouseShipment:create");
  const data = parseOrFail(shipmentSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireRecord("customers", data.customerId, options.idToken, "Customer");
  const numbered = await issueLogisticsNumber("SHP", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    shipmentId: id,
    shipmentNumber: numbered.documentNumber,
    ...data,
    actualDeliveryDate: "",
    podDate: "",
    receiverReference: "",
    status: "draft",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.customerId, data.trackingNumber, data.orderId),
  };
  const writes = [writeOf(LOGISTICS_COLLECTIONS.shipments, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "SHIPMENT_CREATED",
    resource: LOGISTICS_COLLECTIONS.shipments,
    resourceId: id,
    description: `Created shipment ${numbered.documentNumber}.`,
  });
  return { id, record };
}

export async function dispatchShipment(options: { id: string; session: SessionPayload; idToken: string; comment?: string }) {
  ensurePermission(options.session, "warehouseShipment:dispatch");
  const current = await requireRecord(LOGISTICS_COLLECTIONS.shipments, options.id, options.idToken, "Shipment");
  if (text(current.status) === "dispatched" || text(current.status) === "in_transit" || text(current.status) === "delivered") {
    fail("This shipment has already been dispatched.");
  }
  const pickId = text(current.pickId);
  if (pickId) {
    const items = await queryMasterDocuments(LOGISTICS_COLLECTIONS.pickItems, options.idToken, {
      filters: [{ field: "pickId", value: pickId }],
      limit: 50,
    });
    const writes = [];
    for (const itemRow of items) {
      if (isInventoryExpired(itemRow.expiryDate)) fail("Expired stock cannot be dispatched.");
      if (["rejected", "blocked", "quarantine"].includes(text(itemRow.qualityStatus))) fail("Blocked or rejected stock cannot be dispatched.");
      const item = await resolveItem({
        itemType: text(itemRow.itemType || "finished_product"),
        productId: text(itemRow.itemId || itemRow.productId),
        materialId: text(itemRow.materialId),
        idToken: options.idToken,
      });
      const snapshot = snapshotFrom(item, {
        batchNumber: text(itemRow.batchNumber),
        warehouseId: text(itemRow.warehouseId || current.warehouseId),
        locationId: text(itemRow.locationId),
        expiryDate: text(itemRow.expiryDate) || undefined,
      });
      const consumed = await applyReservedConsumption({ snapshot, quantity: Number(itemRow.quantity || itemRow.allocatedQuantity), session: options.session, idToken: options.idToken });
      writes.push(consumed.write);
      writes.push((await createLedgerWrite({
        draft: { type: "SHIP", quantityIn: 0, quantityOut: Number(itemRow.quantity || itemRow.allocatedQuantity), balanceAfter: Number(consumed.record.availableQuantity), referenceType: "shipment", referenceId: options.id, snapshot },
        session: options.session,
        idToken: options.idToken,
      })).write);
      writes.push(writeOf(LOGISTICS_COLLECTIONS.shipmentItems, crypto.randomUUID(), {
        shipmentId: options.id,
        ...itemRow,
        status: "dispatched",
        ...actorStamp(options.session),
      }, { exists: false }));
    }
    const next = { ...current, status: "dispatched", dispatchedAt: new Date().toISOString(), dispatchSignature: electronicSignature(options.session, "dispatch", options.comment), ...actorStamp(options.session, current) };
    writes.push(writeOf(LOGISTICS_COLLECTIONS.shipments, options.id, next));
    await commitWithRetry(writes, options.idToken);
    await auditLogistics(options.idToken, options.session, {
      action: "SHIPMENT_DISPATCHED",
      resource: LOGISTICS_COLLECTIONS.shipments,
      resourceId: options.id,
      description: `Dispatched ${current.shipmentNumber}.`,
    });
    return { id: options.id, record: next };
  }
  const next = { ...current, status: "dispatched", dispatchedAt: new Date().toISOString(), dispatchSignature: electronicSignature(options.session, "dispatch", options.comment), ...actorStamp(options.session, current) };
  await commitWrites([writeOf(LOGISTICS_COLLECTIONS.shipments, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export async function confirmDelivery(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "warehouseShipment:close");
  const current = await requireRecord(LOGISTICS_COLLECTIONS.shipments, options.id, options.idToken, "Shipment");
  if (text(current.status) === "delivered") fail("This shipment is already delivered.");
  const next = {
    ...current,
    status: "delivered",
    actualDeliveryDate: new Date().toISOString(),
    podDate: text(options.payload.podDate) || new Date().toISOString(),
    receiverReference: text(options.payload.receiverReference),
    deliveryRemarks: text(options.payload.remarks),
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(LOGISTICS_COLLECTIONS.shipments, options.id, next)], options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "SHIPMENT_DELIVERED",
    resource: LOGISTICS_COLLECTIONS.shipments,
    resourceId: options.id,
    description: `Delivered ${current.shipmentNumber}.`,
  });
  return { id: options.id, record: next };
}

export async function createCustomerReturn(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "warehouseCustomerReturn:create");
  const data = parseOrFail(customerReturnSchema, options.payload);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  await requireLocation(data.warehouseId, data.locationId, options.idToken);
  const numbered = await issueLogisticsNumber("WRET", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = {
    returnId: id,
    returnNumber: numbered.documentNumber,
    ...data,
    receivedDate: "",
    status: "requested",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.customerId, data.batchNumber, data.productId),
  };
  const writes = [writeOf(LOGISTICS_COLLECTIONS.returns, id, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id, record }, options.session));
  await commitWrites(writes, options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "RETURN_CREATED",
    resource: LOGISTICS_COLLECTIONS.returns,
    resourceId: id,
    description: `Created customer return ${numbered.documentNumber}.`,
  });
  return { id, record };
}

export async function receiveCustomerReturn(options: { id: string; session: SessionPayload; idToken: string; comment?: string }) {
  ensurePermission(options.session, "warehouseCustomerReturn:update");
  const current = await requireRecord(LOGISTICS_COLLECTIONS.returns, options.id, options.idToken, "Return");
  if (["received", "quarantine", "closed"].includes(text(current.status))) fail("This return has already been received.");
  const item = await resolveItem({
    itemType: "finished_product",
    productId: text(current.productId),
    idToken: options.idToken,
  });
  const snapshot = snapshotFrom(item, {
    batchNumber: text(current.batchNumber),
    warehouseId: text(current.warehouseId),
    locationId: text(current.locationId),
    qualityStatus: "quarantine",
  });
  const qty = Number(current.quantity);
  const into = await applyBalanceDelta({ snapshot, delta: qty, session: options.session, idToken: options.idToken });
  const next = { ...current, status: "quarantine", receivedDate: new Date().toISOString(), ...actorStamp(options.session, current) };
  await commitWithRetry([
    into.write,
    (await createLedgerWrite({
      draft: { type: "RETURN_IN", quantityIn: qty, quantityOut: 0, balanceAfter: Number(into.record.availableQuantity), referenceType: "customer_return", referenceId: options.id, snapshot },
      session: options.session,
      idToken: options.idToken,
    })).write,
    writeOf(LOGISTICS_COLLECTIONS.returns, options.id, next),
  ], options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "RETURN_RECEIVED",
    resource: LOGISTICS_COLLECTIONS.returns,
    resourceId: options.id,
    description: `Received ${current.returnNumber} into quarantine. QA disposition is still required.`,
  });
  return { id: options.id, record: next };
}

export async function createCycleCount(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "warehouseCycleCount:create");
  const data = parseOrFail(cycleCountSchema, options.payload);
  const numbered = await issueLogisticsNumber("CNT", options.session, options.idToken);
  const id = crypto.randomUUID();
  const variance = data.countedQuantity === undefined ? 0 : calculateInventoryVariance(data.systemQuantity, data.countedQuantity);
  const record = {
    countId: id,
    countNumber: numbered.documentNumber,
    ...data,
    variance,
    status: "planned",
    ...actorStamp(options.session),
    searchIndex: searchIndex(numbered.documentNumber, data.warehouseId, data.batchNumber),
  };
  await commitWrites([writeOf(LOGISTICS_COLLECTIONS.cycleCounts, id, record, { exists: false })], options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "CYCLE_COUNT_CREATED",
    resource: LOGISTICS_COLLECTIONS.cycleCounts,
    resourceId: id,
    description: `Created cycle count ${numbered.documentNumber}.`,
  });
  return { id, record };
}

export async function approveCycleCount(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "warehouseCycleCount:approve");
  const current = await requireRecord(LOGISTICS_COLLECTIONS.cycleCounts, options.id, options.idToken, "Cycle count");
  preventSelfApproval(options.session, current.createdBy);
  const counted = Number(options.payload.countedQuantity ?? current.countedQuantity ?? 0);
  const variance = calculateInventoryVariance(Number(current.systemQuantity), counted);
  const next = {
    ...current,
    countedQuantity: counted,
    variance,
    status: "approved",
    approvalSignature: electronicSignature(options.session, "approve_count", text(options.payload.reason)),
    ...actorStamp(options.session, current),
  };
  const writes = [writeOf(LOGISTICS_COLLECTIONS.cycleCounts, options.id, next)];
  if (variance !== 0) {
    const reconId = crypto.randomUUID();
    writes.push(writeOf(LOGISTICS_COLLECTIONS.reconciliations, reconId, {
      reconciliationId: reconId,
      countId: options.id,
      systemQuantity: current.systemQuantity,
      countedQuantity: counted,
      variance,
      status: "pending_adjustment",
      ...actorStamp(options.session),
    }, { exists: false }));
    await auditLogistics(options.idToken, options.session, {
      action: "VARIANCE_IDENTIFIED",
      resource: LOGISTICS_COLLECTIONS.cycleCounts,
      resourceId: options.id,
      description: `Variance ${variance} recorded for ${current.countNumber}. Adjustment still requires approval.`,
    });
  }
  await commitWrites(writes, options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "RECONCILIATION_APPROVED",
    resource: LOGISTICS_COLLECTIONS.cycleCounts,
    resourceId: options.id,
    description: `Approved cycle count ${current.countNumber}.`,
  });
  return { id: options.id, record: next };
}

export async function recordTemperature(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "warehouseColdchain:create");
  const data = parseOrFail(temperatureSchema, options.payload);
  const id = crypto.randomUUID();
  const timestamp = data.timestamp || new Date().toISOString();
  const record = {
    monitoringId: id,
    ...data,
    timestamp,
    status: "recorded",
    ...actorStamp(options.session),
    searchIndex: searchIndex(data.deviceId, data.shipmentId, data.warehouseId),
  };
  const writes = [writeOf(LOGISTICS_COLLECTIONS.temperatures, id, record, { exists: false })];
  let excursion = null as { id: string; record: Record<string, unknown> } | null;
  const shipment = data.shipmentId ? await readMasterDocument(LOGISTICS_COLLECTIONS.shipments, data.shipmentId, options.idToken) : null;
  const detected = detectTemperatureExcursion(data.temperature, Number(shipment?.minTemperature), Number(shipment?.maxTemperature));
  if (detected.excursion && shipment) {
    const numbered = await issueLogisticsNumber("EXC", options.session, options.idToken);
    const excursionId = crypto.randomUUID();
    const excursionRecord = {
      excursionId,
      excursionNumber: numbered.documentNumber,
      shipmentId: data.shipmentId,
      warehouseId: data.warehouseId,
      deviceId: data.deviceId,
      detectedAt: timestamp,
      temperature: data.temperature,
      minimumTemperature: shipment.minTemperature,
      maximumTemperature: shipment.maxTemperature,
      status: "potential",
      ...actorStamp(options.session),
      searchIndex: searchIndex(numbered.documentNumber, data.shipmentId),
    };
    writes.push(writeOf(LOGISTICS_COLLECTIONS.excursions, excursionId, excursionRecord, { exists: false }));
    excursion = { id: excursionId, record: excursionRecord };
    await notifyLogistics(options.idToken, options.session, {
      type: "temperature_excursion",
      title: "Potential temperature excursion",
      message: `${numbered.documentNumber} requires QA assessment. The software does not decide product disposition.`,
      resource: LOGISTICS_COLLECTIONS.excursions,
      resourceId: excursionId,
      severity: "critical",
      audienceRoles: ["qa", "warehouse"],
    });
  }
  await commitWrites(writes, options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "TEMPERATURE_RECORD_CREATED",
    resource: LOGISTICS_COLLECTIONS.temperatures,
    resourceId: id,
    description: `Recorded temperature ${data.temperature}${data.unit || "C"}.`,
  });
  if (excursion) {
    await auditLogistics(options.idToken, options.session, {
      action: "TEMPERATURE_EXCURSION_CREATED",
      resource: LOGISTICS_COLLECTIONS.excursions,
      resourceId: excursion.id,
      description: `Opened potential excursion ${excursion.record.excursionNumber}.`,
    });
  }
  return { id, record, extra: { excursion } };
}

export async function decideExcursion(options: { id: string; payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "warehouseExcursion:approve");
  const data = parseOrFail(excursionDecisionSchema, options.payload);
  const current = await requireRecord(LOGISTICS_COLLECTIONS.excursions, options.id, options.idToken, "Excursion");
  preventSelfApproval(options.session, current.createdBy);
  if (text(current.status) === "closed") fail("Closed excursions cannot be silently changed.");
  const next = {
    ...current,
    status: data.decision,
    decision: data.decision,
    rationale: data.rationale,
    capaId: data.capaId || "",
    decisionSignature: electronicSignature(options.session, "excursion_decision", data.rationale),
    ...actorStamp(options.session, current),
  };
  await commitWrites([writeOf(LOGISTICS_COLLECTIONS.excursions, options.id, next)], options.idToken);
  await auditLogistics(options.idToken, options.session, {
    action: "EXCURSION_DECISION",
    resource: LOGISTICS_COLLECTIONS.excursions,
    resourceId: options.id,
    description: `QA recorded ${data.decision} for ${current.excursionNumber}.`,
  });
  return { id: options.id, record: next };
}

export async function createIncident(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "warehouse:update");
  const data = parseOrFail(incidentSchema, options.payload);
  const id = crypto.randomUUID();
  const record = { incidentId: id, ...data, status: "open", ...actorStamp(options.session), searchIndex: searchIndex(data.warehouseId, data.incidentType) };
  await commitWrites([writeOf(LOGISTICS_COLLECTIONS.incidents, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createComplianceCheck(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "warehouse:update");
  const data = parseOrFail(complianceSchema, options.payload);
  const id = crypto.randomUUID();
  const record = { checkId: id, ...data, status: "recorded", ...actorStamp(options.session), searchIndex: searchIndex(data.warehouseId, data.checklistType) };
  await commitWrites([writeOf(LOGISTICS_COLLECTIONS.checks, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createProvider(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "warehouse:update");
  const data = parseOrFail(providerSchema, options.payload);
  const vendor = await requireRecord("vendors", data.vendorId, options.idToken, "Vendor");
  const id = crypto.randomUUID();
  const record = {
    providerId: id,
    ...data,
    vendorName: vendor.vendorName || vendor.name,
    status: "active",
    ...actorStamp(options.session),
    searchIndex: searchIndex(data.vendorId, vendor.vendorName, data.serviceType),
  };
  await commitWrites([writeOf(LOGISTICS_COLLECTIONS.providers, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function createPallet(options: { payload: Record<string, unknown>; session: SessionPayload; idToken: string }) {
  ensurePermission(options.session, "warehouse:update");
  const data = parseOrFail(palletSchema, options.payload);
  const numbered = await issueLogisticsNumber("PAL", options.session, options.idToken);
  const id = crypto.randomUUID();
  const record = { palletId: id, palletNumber: numbered.documentNumber, ...data, status: "open", ...actorStamp(options.session), searchIndex: searchIndex(numbered.documentNumber, data.batchNumber) };
  await commitWrites([writeOf(LOGISTICS_COLLECTIONS.pallets, id, record, { exists: false })], options.idToken);
  return { id, record };
}

export async function advanceLogisticsRecord(options: {
  collection: string;
  id: string;
  next: string;
  map: Record<string, string[]>;
  permission: Permission;
  session: SessionPayload;
  idToken: string;
  comment?: string;
  extra?: Record<string, unknown>;
}) {
  ensurePermission(options.session, options.permission);
  const current = await requireRecord(options.collection, options.id, options.idToken, "Record");
  if (!canTransition(options.map, text(current.status), options.next)) {
    fail(`Cannot move from "${current.status}" to "${options.next}".`);
  }
  const next = { ...current, ...options.extra, status: options.next, ...actorStamp(options.session, current) };
  await commitWrites([writeOf(options.collection, options.id, next)], options.idToken);
  return { id: options.id, record: next };
}

export { PUTAWAY_TRANSITIONS, MOVEMENT_TRANSITIONS, PICK_TRANSITIONS, PACK_TRANSITIONS, SHIPMENT_TRANSITIONS, RETURN_TRANSITIONS, COUNT_TRANSITIONS, EXCURSION_TRANSITIONS };
