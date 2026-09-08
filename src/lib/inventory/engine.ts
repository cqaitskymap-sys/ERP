import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import { isInventoryExpired } from "@/lib/inventory/expiry";
import {
  actorStamp,
  fail,
  issueWarehouseNumber,
  requireRecord,
  text,
  writeOf,
} from "@/lib/inventory/helpers";
import {
  balanceKey,
  itemCollection,
  nameIndex,
  normalizeBatchNumber,
  roundQuantity,
  searchIndex,
} from "@/lib/inventory/keys";
import { inventoryStatusForQuality } from "@/lib/inventory/quality";
import {
  commitMasterDocuments,
  readMasterDocument,
  type AtomicWrite,
  type MasterRecord,
} from "@/lib/masters/firestore";
import type { SessionPayload } from "@/types/auth";
import type { LedgerTransactionType } from "@/types/inventory";

export interface StockSnapshot {
  itemType: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  materialId?: string;
  productId?: string;
  batchNumber: string;
  lotNumber?: string;
  warehouseId: string;
  locationId: string;
  qualityStatus: string;
  inventoryStatus?: string;
  uom: string;
  expiryDate?: string;
  inventoryBatchId?: string;
}

export interface LedgerDraft {
  type: LedgerTransactionType;
  quantityIn: number;
  quantityOut: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string;
  remarks?: string;
  snapshot: StockSnapshot;
}

export async function readBalanceByKey(key: string, idToken: string) {
  return readMasterDocument(INVENTORY_COLLECTIONS.balances, key, idToken);
}

export async function readBalanceFor(snapshot: StockSnapshot, idToken: string) {
  return readBalanceByKey(
    balanceKey({
      itemType: snapshot.itemType,
      itemId: snapshot.itemId,
      batchNumber: snapshot.batchNumber,
      warehouseId: snapshot.warehouseId,
      locationId: snapshot.locationId,
      qualityStatus: snapshot.qualityStatus,
    }),
    idToken
  );
}

function searchFor(snapshot: StockSnapshot, extra: string[] = []) {
  return searchIndex(
    snapshot.itemCode,
    snapshot.itemName,
    snapshot.batchNumber,
    snapshot.lotNumber,
    snapshot.warehouseId,
    snapshot.locationId,
    snapshot.qualityStatus,
    ...extra
  );
}

export function buildBalanceRecord(
  snapshot: StockSnapshot,
  quantity: number,
  session: SessionPayload,
  existing?: MasterRecord | null
) {
  const id = balanceKey({
    itemType: snapshot.itemType,
    itemId: snapshot.itemId,
    batchNumber: snapshot.batchNumber,
    warehouseId: snapshot.warehouseId,
    locationId: snapshot.locationId,
    qualityStatus: snapshot.qualityStatus,
  });
  const available = roundQuantity(quantity);
  const quality = snapshot.qualityStatus;
  return {
    id,
    balanceId: id,
    inventoryBatchId: snapshot.inventoryBatchId || text(existing?.inventoryBatchId),
    itemType: snapshot.itemType,
    itemId: snapshot.itemId,
    materialId: snapshot.materialId || (snapshot.itemType === "material" ? snapshot.itemId : ""),
    productId: snapshot.productId || (snapshot.itemType === "material" ? "" : snapshot.itemId),
    itemCode: snapshot.itemCode,
    itemName: snapshot.itemName,
    batchNumber: normalizeBatchNumber(snapshot.batchNumber),
    lotNumber: snapshot.lotNumber || "",
    warehouseId: snapshot.warehouseId,
    locationId: snapshot.locationId,
    qualityStatus: quality,
    inventoryStatus: snapshot.inventoryStatus || inventoryStatusForQuality(quality),
    availableQuantity: available,
    reservedQuantity: Number(existing?.reservedQuantity || 0),
    rejectedQuantity: quality === "rejected" ? available : Number(existing?.rejectedQuantity || 0),
    uom: snapshot.uom,
    expiryDate: snapshot.expiryDate || existing?.expiryDate || "",
    searchIndex: searchFor(snapshot),
    nameIndex: nameIndex(snapshot.itemName),
    status: available <= 0 ? "closed" : "active",
    ...actorStamp(session, existing || undefined),
  };
}

export async function applyReservationDelta(options: {
  snapshot: StockSnapshot;
  reservedDelta: number;
  session: SessionPayload;
  idToken: string;
}): Promise<{ record: Record<string, unknown>; write: AtomicWrite; previousAvailable: number; previousReserved: number }> {
  const existing = await readBalanceFor(options.snapshot, options.idToken);
  if (!existing) fail("Inventory balance was not found for reservation.");
  const previousAvailable = roundQuantity(existing.availableQuantity);
  const previousReserved = roundQuantity(existing.reservedQuantity);
  const nextAvailable = roundQuantity(previousAvailable - options.reservedDelta);
  const nextReserved = roundQuantity(previousReserved + options.reservedDelta);
  if (nextAvailable < -1e-9) fail("Insufficient available quantity.");
  if (nextReserved < -1e-9) fail("Reservation quantity cannot become negative.");
  const record = {
    ...buildBalanceRecord(options.snapshot, Math.max(0, nextAvailable), options.session, existing),
    reservedQuantity: Math.max(0, nextReserved),
    inventoryStatus: nextReserved > 0 ? "reserved" : inventoryStatusForQuality(options.snapshot.qualityStatus),
  };
  return {
    record,
    previousAvailable,
    previousReserved,
    write: writeOf(INVENTORY_COLLECTIONS.balances, String(record.id), record, {
      updateTime: existing._updateTime ? String(existing._updateTime) : undefined,
    }),
  };
}

export async function applyReservedConsumption(options: {
  snapshot: StockSnapshot;
  quantity: number;
  session: SessionPayload;
  idToken: string;
}): Promise<{ record: Record<string, unknown>; write: AtomicWrite }> {
  const existing = await readBalanceFor(options.snapshot, options.idToken);
  if (!existing) fail("Inventory balance was not found.");
  const nextReserved = roundQuantity(Number(existing.reservedQuantity || 0) - options.quantity);
  if (nextReserved < -1e-9) fail("Insufficient reserved quantity.");
  const record = {
    ...buildBalanceRecord(options.snapshot, roundQuantity(existing.availableQuantity), options.session, existing),
    reservedQuantity: Math.max(0, nextReserved),
    inventoryStatus: nextReserved > 0 ? "reserved" : inventoryStatusForQuality(options.snapshot.qualityStatus),
  };
  return {
    record,
    write: writeOf(INVENTORY_COLLECTIONS.balances, String(record.id), record, {
      updateTime: existing._updateTime ? String(existing._updateTime) : undefined,
    }),
  };
}

export async function applyBalanceDelta(options: {
  snapshot: StockSnapshot;
  delta: number;
  session: SessionPayload;
  idToken: string;
}): Promise<{ record: Record<string, unknown>; write: AtomicWrite; previous: number }> {
  const existing = await readBalanceFor(options.snapshot, options.idToken);
  const previous = roundQuantity(existing?.availableQuantity || 0);
  const next = roundQuantity(previous + options.delta);
  if (next < -1e-9) fail("Insufficient available quantity.");
  const record = buildBalanceRecord(options.snapshot, Math.max(0, next), options.session, existing);
  return {
    record,
    previous,
    write: writeOf(INVENTORY_COLLECTIONS.balances, String(record.id), record, {
      updateTime: existing?._updateTime ? String(existing._updateTime) : undefined,
      exists: existing ? undefined : false,
    }),
  };
}

export async function createLedgerWrite(options: {
  draft: LedgerDraft;
  session: SessionPayload;
  idToken: string;
}): Promise<{ write: AtomicWrite; record: Record<string, unknown> }> {
  const numbered = await issueWarehouseNumber("LED", options.session, options.idToken);
  const id = crypto.randomUUID();
  const snapshot = options.draft.snapshot;
  const record = {
    ledgerId: id,
    transactionNumber: numbered.documentNumber,
    transactionType: options.draft.type,
    itemType: snapshot.itemType,
    itemId: snapshot.itemId,
    materialId: snapshot.materialId || "",
    productId: snapshot.productId || "",
    itemCode: snapshot.itemCode,
    itemName: snapshot.itemName,
    batchNumber: normalizeBatchNumber(snapshot.batchNumber),
    lotNumber: snapshot.lotNumber || "",
    warehouseId: snapshot.warehouseId,
    locationId: snapshot.locationId,
    quantityIn: roundQuantity(options.draft.quantityIn),
    quantityOut: roundQuantity(options.draft.quantityOut),
    balanceAfter: roundQuantity(options.draft.balanceAfter),
    uom: snapshot.uom,
    qualityStatus: snapshot.qualityStatus,
    referenceType: options.draft.referenceType,
    referenceId: options.draft.referenceId,
    performedBy: options.session.uid,
    performedAt: new Date().toISOString(),
    remarks: options.draft.remarks || "",
    searchIndex: searchFor(snapshot, [numbered.documentNumber, options.draft.type]),
    nameIndex: nameIndex(snapshot.itemName),
    createdBy: options.session.uid,
    createdAt: new Date().toISOString(),
    updatedBy: options.session.uid,
    updatedAt: new Date().toISOString(),
  };
  return {
    record,
    write: writeOf(INVENTORY_COLLECTIONS.ledger, id, record, { exists: false }),
  };
}

export function statusHistoryWrite(options: {
  inventoryBatchId: string;
  previousStatus: string;
  newStatus: string;
  kind: "quality" | "inventory" | "document";
  reason?: string;
  reference?: string;
  session: SessionPayload;
}) {
  const id = crypto.randomUUID();
  return writeOf(
    INVENTORY_COLLECTIONS.statusHistory,
    id,
    {
      historyId: id,
      inventoryBatchId: options.inventoryBatchId,
      kind: options.kind,
      previousStatus: options.previousStatus,
      newStatus: options.newStatus,
      reason: options.reason || "",
      reference: options.reference || "",
      performedBy: options.session.uid,
      performedAt: new Date().toISOString(),
      createdBy: options.session.uid,
      createdAt: new Date().toISOString(),
      updatedBy: options.session.uid,
      updatedAt: new Date().toISOString(),
    },
    { exists: false }
  );
}

export function traceabilityWrite(options: {
  inventoryBatchId: string;
  batchNumber: string;
  eventType: string;
  title: string;
  detail?: string;
  referenceType?: string;
  referenceId?: string;
  session: SessionPayload;
}) {
  const id = crypto.randomUUID();
  return writeOf(
    INVENTORY_COLLECTIONS.traceability,
    id,
    {
      eventId: id,
      inventoryBatchId: options.inventoryBatchId,
      batchNumber: normalizeBatchNumber(options.batchNumber),
      eventType: options.eventType,
      title: options.title,
      detail: options.detail || "",
      referenceType: options.referenceType || "",
      referenceId: options.referenceId || "",
      performedBy: options.session.uid,
      performedAt: new Date().toISOString(),
      createdBy: options.session.uid,
      createdAt: new Date().toISOString(),
      updatedBy: options.session.uid,
      updatedAt: new Date().toISOString(),
    },
    { exists: false }
  );
}

export async function resolveItem(options: {
  itemType: string;
  materialId?: string;
  productId?: string;
  idToken: string;
}) {
  const itemType = options.itemType || "material";
  const itemId = text(itemType === "material" ? options.materialId : options.productId);
  if (!itemId) fail(itemType === "material" ? "Material is required." : "Product is required.");
  const record = await requireRecord(itemCollection(itemType), itemId, options.idToken, itemType === "material" ? "Material" : "Product");
  const code = text(record.materialCode || record.productCode);
  const name = text(record.materialName || record.productName);
  return {
    itemType,
    itemId,
    itemCode: code,
    itemName: name,
    materialId: itemType === "material" ? itemId : "",
    productId: itemType === "material" ? "" : itemId,
    uom: text(record.uom),
    master: record,
  };
}

export async function requireLocation(
  warehouseId: string,
  locationId: string,
  idToken: string
) {
  const warehouse = await requireRecord("warehouses", warehouseId, idToken, "Warehouse");
  const location = await requireRecord("storageLocations", locationId, idToken, "Storage location");
  if (text(location.warehouseId) !== warehouseId) {
    fail("Storage location does not belong to the selected warehouse.");
  }
  return { warehouse, location };
}

export function assertNotExpiredForIssue(expiryDate: unknown) {
  if (isInventoryExpired(expiryDate)) fail("Expired stock cannot be issued.");
}

export async function commitWithRetry(writes: AtomicWrite[], idToken: string, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await commitMasterDocuments(writes, idToken);
      return;
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || error.name !== "ConflictError") throw error;
    }
  }
  fail(
    lastError instanceof Error
      ? "This stock movement could not be completed because the balance changed. Try again."
      : "This stock movement could not be completed. Try again."
  );
}

export async function readIdempotency(key: string | undefined, idToken: string) {
  if (!key) return null;
  return readMasterDocument(INVENTORY_COLLECTIONS.idempotency, key, idToken);
}

export function idempotencyWrite(
  key: string,
  result: Record<string, unknown>,
  session: SessionPayload
) {
  return writeOf(
    INVENTORY_COLLECTIONS.idempotency,
    key,
    {
      idempotencyKey: key,
      result,
      createdBy: session.uid,
      createdAt: new Date().toISOString(),
      updatedBy: session.uid,
      updatedAt: new Date().toISOString(),
    },
    { exists: false }
  );
}
