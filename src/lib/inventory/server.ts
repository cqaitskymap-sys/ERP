import { canAccess, hasAnyPermission, hasPermission } from "@/lib/permissions/permission-service";
import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import { selectFefoBatches } from "@/lib/inventory/fefo";
import { issueBlockReason } from "@/lib/inventory/eligibility";
import {
  applyBalanceDelta,
  assertNotExpiredForIssue,
  buildBalanceRecord,
  commitWithRetry,
  createLedgerWrite,
  idempotencyWrite,
  readBalanceByKey,
  readIdempotency,
  requireLocation,
  resolveItem,
  statusHistoryWrite,
  traceabilityWrite,
  type StockSnapshot,
} from "@/lib/inventory/engine";
import {
  actorStamp,
  auditWarehouse,
  fail,
  issueWarehouseNumber,
  notifyWarehouse,
  parseOrFail,
  requireActiveMaster,
  requireRecord,
  text,
  writeOf,
} from "@/lib/inventory/helpers";
import { balanceKey, normalizeBatchNumber, roundQuantity, searchIndex } from "@/lib/inventory/keys";
import {
  canTransitionQuality,
  inventoryStatusForQuality,
  permissionForQualityTransition,
  qualityAuditAction,
  qualityLedgerType,
} from "@/lib/inventory/quality";
import { queryMasterDocuments, readMasterDocument, type AtomicWrite } from "@/lib/masters/firestore";
import { applyPurchaseOrderReceipt, assertReceivableStatus, loadPoWithItems, validateReceiptAgainstPo } from "@/lib/procurement/receipts";
import { markGoodsReceiptLinked, vendorPerformanceWriteFromReceipt } from "@/lib/procurement/server";
import {
  goodsReceiptSchema,
  inventoryDocumentSchema,
  qualityTransitionSchema,
  receivingCheckSchema,
  stockAdjustmentSchema,
  stockIssueSchema,
  stockReturnSchema,
  stockTransferSchema,
} from "@/lib/validation/inventory";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";
import type { FefoCandidate } from "@/types/inventory";

function ensurePermission(session: SessionPayload, permission: Permission) {
  if (!canAccess(session, permission)) {
    fail("You do not have permission for this action.");
  }
}

function workflowFail(current: string, action: string): never {
  fail(`Cannot ${action} a record in "${current}" status.`);
}

async function reuseIdempotent(key: string | undefined, idToken: string) {
  if (!key) return null;
  const existing = await readIdempotency(key, idToken);
  if (existing?.result && typeof existing.result === "object") {
    return existing.result as Record<string, unknown>;
  }
  return null;
}

function snapshotFromBalance(balance: Record<string, unknown>, overrides: Partial<StockSnapshot> = {}): StockSnapshot {
  return {
    itemType: text(overrides.itemType || balance.itemType || "material"),
    itemId: text(overrides.itemId || balance.itemId),
    itemCode: text(overrides.itemCode || balance.itemCode),
    itemName: text(overrides.itemName || balance.itemName),
    materialId: text(overrides.materialId || balance.materialId),
    productId: text(overrides.productId || balance.productId),
    batchNumber: normalizeBatchNumber(overrides.batchNumber || balance.batchNumber),
    lotNumber: text(overrides.lotNumber || balance.lotNumber),
    warehouseId: text(overrides.warehouseId || balance.warehouseId),
    locationId: text(overrides.locationId || balance.locationId),
    qualityStatus: text(overrides.qualityStatus || balance.qualityStatus),
    inventoryStatus: text(overrides.inventoryStatus || balance.inventoryStatus),
    uom: text(overrides.uom || balance.uom),
    expiryDate: text(overrides.expiryDate || balance.expiryDate),
    inventoryBatchId: text(overrides.inventoryBatchId || balance.inventoryBatchId),
  };
}

export async function saveGoodsReceipt(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
  id?: string;
}) {
  ensurePermission(options.session, "goodsReceipt:create");
  const data = parseOrFail(goodsReceiptSchema, options.payload);
  await requireActiveMaster("warehouses", data.warehouseId, options.idToken, "Warehouse");
  await requireLocation(data.warehouseId, data.receivingLocationId, options.idToken);
  if (data.supplierId) {
    const supplier =
      (await readMasterDocument("suppliers", data.supplierId, options.idToken)) ||
      (await readMasterDocument("vendors", data.supplierId, options.idToken));
    if (!supplier) fail("Supplier was not found.");
  }

  let poNumber = "";
  if (data.purchaseOrderId) {
    const { order, items } = await loadPoWithItems(data.purchaseOrderId, options.idToken);
    assertReceivableStatus(text(order.status));
    if (data.supplierId && text(order.vendorId) && text(order.vendorId) !== data.supplierId) {
      fail("Goods receipt vendor must match the purchase order vendor.");
    }
    validateReceiptAgainstPo({
      order,
      items,
      receiptItems: data.items.map((item) => ({
        materialId: item.materialId,
        purchaseOrderItemId: item.purchaseOrderItemId,
        quantity: Number(item.quantity),
      })),
      overReceiptApproved: hasPermission(options.session.permissions, "purchaseOrder:approve"),
    });
    poNumber = text(order.poNumber);
  }

  const existing = options.id
    ? await requireRecord(INVENTORY_COLLECTIONS.receipts, options.id, options.idToken, "Goods receipt")
    : null;
  if (existing && text(existing.status) !== "draft") fail("Only draft receipts can be edited.");

  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;

  const receiptId = options.id || crypto.randomUUID();
  const numbered = existing
    ? { documentNumber: text(existing.receiptNumber) }
    : await issueWarehouseNumber("GRN", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const items: Record<string, unknown>[] = [];

  for (const item of data.items) {
    const resolved = await resolveItem({
      itemType: item.itemType || data.itemType,
      materialId: item.materialId,
      productId: item.productId,
      idToken: options.idToken,
    });
    const itemId = crypto.randomUUID();
    const record = {
      receiptItemId: itemId,
      receiptId,
      ...item,
      itemType: resolved.itemType,
      materialId: resolved.materialId,
      productId: resolved.productId,
      itemCode: resolved.itemCode,
      itemName: resolved.itemName,
      batchNumber: normalizeBatchNumber(item.batchNumber),
      uom: item.uom || resolved.uom,
      quantity: roundQuantity(item.quantity),
      searchIndex: searchIndex(resolved.itemCode, resolved.itemName, item.batchNumber),
      ...actorStamp(options.session),
    };
    items.push(record);
    writes.push(writeOf(INVENTORY_COLLECTIONS.receiptItems, itemId, record, { exists: false }));
  }

  const receipt = {
    receiptId,
    receiptNumber: numbered.documentNumber,
    receiptDate: data.receiptDate,
    supplierId: data.supplierId || "",
    sourceReference: data.sourceReference || poNumber,
    purchaseOrderId: data.purchaseOrderId || "",
    poNumber,
    warehouseId: data.warehouseId,
    receivingLocationId: data.receivingLocationId,
    itemType: data.itemType,
    status: "draft",
    verificationStatus: "pending",
    receivedBy: "",
    verifiedBy: "",
    remarks: data.remarks || "",
    itemCount: items.length,
    searchIndex: searchIndex(numbered.documentNumber, data.sourceReference || poNumber, data.supplierId, data.purchaseOrderId),
    nameIndex: numbered.documentNumber.toLowerCase(),
    ...actorStamp(options.session, existing || undefined),
  };
  writes.push(
    writeOf(INVENTORY_COLLECTIONS.receipts, receiptId, receipt, {
      updateTime: existing?._updateTime ? String(existing._updateTime) : undefined,
      exists: existing ? undefined : false,
    })
  );
  if (data.idempotencyKey) {
    writes.push(idempotencyWrite(data.idempotencyKey, { id: receiptId, record: receipt }, options.session));
  }
  await commitWithRetry(writes, options.idToken);
  await auditWarehouse(options.idToken, options.session, {
    action: existing ? "UPDATE" : "CREATE",
    resource: INVENTORY_COLLECTIONS.receipts,
    resourceId: receiptId,
    description: `${existing ? "Updated" : "Created"} goods receipt ${numbered.documentNumber}.`,
    newData: { receiptNumber: numbered.documentNumber, status: "draft" },
  });
  return { id: receiptId, record: receipt, items };
}

export async function receiveGoodsReceipt(options: {
  id: string;
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  ensurePermission(options.session, "goodsReceipt:create");
  const receipt = await requireRecord(INVENTORY_COLLECTIONS.receipts, options.id, options.idToken, "Goods receipt");
  if (text(receipt.status) !== "draft") workflowFail(text(receipt.status), "receive");
  const items = await queryMasterDocuments(INVENTORY_COLLECTIONS.receiptItems, options.idToken, {
    filters: [{ field: "receiptId", value: options.id }],
    limit: 100,
  });
  if (!items.length) fail("Add receipt items before receiving stock.");

  const writes: AtomicWrite[] = [];
  for (const item of items) {
    const batchId = crypto.randomUUID();
    const snapshot: StockSnapshot = {
      itemType: text(item.itemType || receipt.itemType || "material"),
      itemId: text(item.materialId || item.productId || item.itemId),
      itemCode: text(item.itemCode),
      itemName: text(item.itemName),
      materialId: text(item.materialId),
      productId: text(item.productId),
      batchNumber: normalizeBatchNumber(item.batchNumber),
      lotNumber: text(item.lotNumber),
      warehouseId: text(receipt.warehouseId),
      locationId: text(receipt.receivingLocationId),
      qualityStatus: "quarantine",
      inventoryStatus: "on_hold",
      uom: text(item.uom),
      expiryDate: text(item.expiryDate),
      inventoryBatchId: batchId,
    };
    const qty = roundQuantity(item.quantity);
    const batch = {
      inventoryBatchId: batchId,
      ...snapshot,
      supplierBatchNumber: text(item.supplierBatchNumber),
      manufacturerBatchNumber: text(item.manufacturerBatchNumber),
      manufacturingDate: text(item.manufacturingDate),
      retestDate: text(item.retestDate),
      receivedDate: text(receipt.receiptDate) || new Date().toISOString(),
      initialQuantity: qty,
      availableQuantity: qty,
      reservedQuantity: 0,
      rejectedQuantity: 0,
      damagedQuantity: 0,
      sourceType: "goods_receipt",
      sourceReference: text(receipt.receiptNumber),
      qcStatus: "pending",
      qaStatus: "pending",
      supplierId: text(receipt.supplierId),
      searchIndex: searchIndex(snapshot.itemCode, snapshot.itemName, snapshot.batchNumber, receipt.receiptNumber),
      nameIndex: searchIndex(snapshot.itemName, snapshot.batchNumber),
      status: "active",
      ...actorStamp(options.session),
    };
    writes.push(writeOf(INVENTORY_COLLECTIONS.batches, batchId, batch, { exists: false }));
    const applied = await applyBalanceDelta({
      snapshot,
      delta: qty,
      session: options.session,
      idToken: options.idToken,
    });
    writes.push(applied.write);
    const ledger = await createLedgerWrite({
      session: options.session,
      idToken: options.idToken,
      draft: {
        type: "RECEIPT",
        quantityIn: qty,
        quantityOut: 0,
        balanceAfter: roundQuantity(applied.record.availableQuantity),
        referenceType: INVENTORY_COLLECTIONS.receipts,
        referenceId: options.id,
        remarks: text(receipt.remarks),
        snapshot,
      },
    });
    writes.push(ledger.write);
    writes.push(
      statusHistoryWrite({
        inventoryBatchId: batchId,
        previousStatus: "",
        newStatus: "quarantine",
        kind: "quality",
        reason: "Goods receipt",
        reference: text(receipt.receiptNumber),
        session: options.session,
      })
    );
    writes.push(
      traceabilityWrite({
        inventoryBatchId: batchId,
        batchNumber: snapshot.batchNumber,
        eventType: "RECEIPT",
        title: "Received into quarantine",
        detail: `${qty} ${snapshot.uom} received via ${text(receipt.receiptNumber)}.`,
        referenceType: INVENTORY_COLLECTIONS.receipts,
        referenceId: options.id,
        session: options.session,
      })
    );
    writes.push(
      writeOf(INVENTORY_COLLECTIONS.receiptItems, String(item.id), {
        ...item,
        inventoryBatchId: batchId,
        updatedBy: options.session.uid,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  const nextReceipt = {
    ...receipt,
    status: "received",
    receivedBy: options.session.uid,
    updatedBy: options.session.uid,
    updatedAt: new Date().toISOString(),
  };
  writes.push(
    writeOf(INVENTORY_COLLECTIONS.receipts, options.id, nextReceipt, {
      updateTime: receipt._updateTime ? String(receipt._updateTime) : undefined,
    })
  );
  if (text(receipt.purchaseOrderId)) {
    const applied = await applyPurchaseOrderReceipt({
      purchaseOrderId: text(receipt.purchaseOrderId),
      receiptId: options.id,
      receiptNumber: text(receipt.receiptNumber),
      receiptItems: items,
      session: options.session,
      idToken: options.idToken,
      overReceiptApproved: hasPermission(options.session.permissions, "purchaseOrder:approve"),
    });
    writes.push(...applied.writes);
    writes.push(
      vendorPerformanceWriteFromReceipt({
        vendorId: applied.vendorId || text(receipt.supplierId),
        purchaseOrderId: text(receipt.purchaseOrderId),
        receiptId: options.id,
        expectedDeliveryDate: applied.expectedDeliveryDate,
        orderedQuantity: applied.orderedQuantity,
        receivedQuantity: applied.receivedThisTime,
        session: options.session,
      })
    );
    await commitWithRetry(writes, options.idToken);
    await markGoodsReceiptLinked({
      purchaseOrderId: text(receipt.purchaseOrderId),
      receiptId: options.id,
      receiptNumber: text(receipt.receiptNumber),
      session: options.session,
      idToken: options.idToken,
      remaining: applied.remaining,
      nextStatus: applied.nextStatus,
    });
  } else {
    await commitWithRetry(writes, options.idToken);
  }
  await auditWarehouse(options.idToken, options.session, {
    action: "RECEIVE",
    resource: INVENTORY_COLLECTIONS.receipts,
    resourceId: options.id,
    description: `Received ${text(receipt.receiptNumber)} into quarantine.`,
    oldData: { status: receipt.status },
    newData: { status: "received" },
    reason: options.reason,
  });
  await notifyWarehouse(options.idToken, options.session, {
    type: "material_received",
    title: "Material received",
    message: `${text(receipt.receiptNumber)} was received and placed in quarantine.`,
    resource: INVENTORY_COLLECTIONS.receipts,
    resourceId: options.id,
    audienceRoles: ["warehouse", "qa", "qc"],
  });
  await notifyWarehouse(options.idToken, options.session, {
    type: "qc_pending",
    title: "QC pending",
    message: `${text(receipt.receiptNumber)} is waiting for quality testing.`,
    resource: INVENTORY_COLLECTIONS.receipts,
    resourceId: options.id,
    severity: "warning",
    audienceRoles: ["qa", "qc"],
  });
  try {
    const { createSampleRequestFromGoodsReceipt } = await import("@/lib/qc/server");
    await createSampleRequestFromGoodsReceipt({
      receipt: { ...nextReceipt, id: options.id },
      items,
      session: options.session,
      idToken: options.idToken,
    });
  } catch {
    await notifyWarehouse(options.idToken, options.session, {
      type: "qc_pending",
      title: "QC sample request pending",
      message: `${text(receipt.receiptNumber)} is in quarantine. Create the sample request from Quality Control if it was not generated.`,
      resource: INVENTORY_COLLECTIONS.receipts,
      resourceId: options.id,
      audienceRoles: ["qc"],
    });
  }
  return { id: options.id, record: nextReceipt };
}

export async function verifyGoodsReceipt(options: {
  id: string;
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "goodsReceipt:verify");
  const receipt = await requireRecord(INVENTORY_COLLECTIONS.receipts, options.id, options.idToken, "Goods receipt");
  if (!["received", "under_inspection"].includes(text(receipt.status))) {
    workflowFail(text(receipt.status), "verify");
  }
  const check = parseOrFail(receivingCheckSchema, options.payload);
  const nextStatus = check.verificationStatus === "verified" ? "completed" : "under_inspection";
  const next = {
    ...receipt,
    ...check,
    status: nextStatus,
    verifiedBy: options.session.uid,
    updatedBy: options.session.uid,
    updatedAt: new Date().toISOString(),
  };
  await commitWithRetry(
    [
      writeOf(INVENTORY_COLLECTIONS.receipts, options.id, next, {
        updateTime: receipt._updateTime ? String(receipt._updateTime) : undefined,
      }),
    ],
    options.idToken
  );
  await auditWarehouse(options.idToken, options.session, {
    action: "VERIFY",
    resource: INVENTORY_COLLECTIONS.receipts,
    resourceId: options.id,
    description: `Verified ${text(receipt.receiptNumber)} (${check.verificationStatus}).`,
    oldData: { status: receipt.status },
    newData: { status: nextStatus, verificationStatus: check.verificationStatus },
    reason: check.remarks,
  });
  return { id: options.id, record: next };
}

export async function cancelWarehouseDocument(options: {
  collection: string;
  id: string;
  session: SessionPayload;
  idToken: string;
  allowedFrom: string[];
  permission: Permission;
  reason?: string;
}) {
  ensurePermission(options.session, options.permission);
  const record = await requireRecord(options.collection, options.id, options.idToken, "Document");
  if (!options.allowedFrom.includes(text(record.status))) workflowFail(text(record.status), "cancel");
  const next = {
    ...record,
    status: "cancelled",
    updatedBy: options.session.uid,
    updatedAt: new Date().toISOString(),
  };
  await commitWithRetry(
    [
      writeOf(options.collection, options.id, next, {
        updateTime: record._updateTime ? String(record._updateTime) : undefined,
      }),
    ],
    options.idToken
  );
  await auditWarehouse(options.idToken, options.session, {
    action: "CANCEL",
    resource: options.collection,
    resourceId: options.id,
    description: `Cancelled warehouse document ${text(record.receiptNumber || record.transferNumber || record.issueNumber || record.returnNumber || record.adjustmentNumber || options.id)}.`,
    oldData: { status: record.status },
    newData: { status: "cancelled" },
    reason: options.reason,
  });
  return { id: options.id, record: next };
}

export async function saveStockTransfer(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "stockTransfer:create");
  const data = parseOrFail(stockTransferSchema, options.payload);
  if (data.fromWarehouseId === data.toWarehouseId && data.fromLocationId === data.toLocationId) {
    fail("Source and destination locations must be different.");
  }
  await requireLocation(data.fromWarehouseId, data.fromLocationId, options.idToken);
  await requireLocation(data.toWarehouseId, data.toLocationId, options.idToken);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;

  const transferId = crypto.randomUUID();
  const numbered = await issueWarehouseNumber("TRF", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const items: Record<string, unknown>[] = [];
  for (const item of data.items) {
    const itemId = crypto.randomUUID();
    const record = {
      transferItemId: itemId,
      transferId,
      ...item,
      batchNumber: normalizeBatchNumber(item.batchNumber),
      quantity: roundQuantity(item.quantity),
      ...actorStamp(options.session),
    };
    items.push(record);
    writes.push(writeOf(INVENTORY_COLLECTIONS.transferItems, itemId, record, { exists: false }));
  }
  const transfer = {
    transferId,
    transferNumber: numbered.documentNumber,
    fromWarehouseId: data.fromWarehouseId,
    fromLocationId: data.fromLocationId,
    toWarehouseId: data.toWarehouseId,
    toLocationId: data.toLocationId,
    reason: data.reason,
    remarks: data.remarks || "",
    requestedBy: options.session.uid,
    approvedBy: "",
    completedBy: "",
    status: "draft",
    searchIndex: searchIndex(numbered.documentNumber, data.reason),
    nameIndex: numbered.documentNumber.toLowerCase(),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(INVENTORY_COLLECTIONS.transfers, transferId, transfer, { exists: false }));
  if (data.idempotencyKey) {
    writes.push(idempotencyWrite(data.idempotencyKey, { id: transferId, record: transfer }, options.session));
  }
  await commitWithRetry(writes, options.idToken);
  await auditWarehouse(options.idToken, options.session, {
    action: "CREATE",
    resource: INVENTORY_COLLECTIONS.transfers,
    resourceId: transferId,
    description: `Created stock transfer ${numbered.documentNumber}.`,
    newData: { transferNumber: numbered.documentNumber, status: "draft" },
    reason: data.reason,
  });
  return { id: transferId, record: transfer, items };
}

export async function transitionStockTransfer(options: {
  id: string;
  action: "request" | "approve" | "start" | "complete" | "cancel";
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  const transfer = await requireRecord(INVENTORY_COLLECTIONS.transfers, options.id, options.idToken, "Stock transfer");
  const status = text(transfer.status);
  if (options.action === "cancel") {
    return cancelWarehouseDocument({
      collection: INVENTORY_COLLECTIONS.transfers,
      id: options.id,
      session: options.session,
      idToken: options.idToken,
      allowedFrom: ["draft", "requested"],
      permission: "stockTransfer:create",
      reason: options.reason,
    });
  }
  if (options.action === "request") {
    ensurePermission(options.session, "stockTransfer:create");
    if (status !== "draft") workflowFail(status, "request");
    return patchStatus(INVENTORY_COLLECTIONS.transfers, transfer, "requested", options, "Requested stock transfer.");
  }
  if (options.action === "approve") {
    ensurePermission(options.session, "stockTransfer:approve");
    if (status !== "requested") workflowFail(status, "approve");
    return patchStatus(
      INVENTORY_COLLECTIONS.transfers,
      { ...transfer, approvedBy: options.session.uid },
      "approved",
      options,
      "Approved stock transfer."
    );
  }
  if (options.action === "start") {
    ensurePermission(options.session, "stockTransfer:complete");
    if (status !== "approved") workflowFail(status, "start");
    return patchStatus(INVENTORY_COLLECTIONS.transfers, transfer, "in_transit", options, "Stock transfer in transit.");
  }
  if (options.action === "complete") {
    ensurePermission(options.session, "stockTransfer:complete");
    if (!["approved", "in_transit"].includes(status)) workflowFail(status, "complete");
    return completeStockTransfer(options.id, transfer, options.session, options.idToken, options.reason);
  }
  fail("Unknown transfer action.");
}

async function patchStatus(
  collection: string,
  record: Record<string, unknown> & { id?: string; _updateTime?: string },
  nextStatus: string,
  options: { id: string; session: SessionPayload; idToken: string; reason?: string },
  description: string
) {
  const next = {
    ...record,
    status: nextStatus,
    updatedBy: options.session.uid,
    updatedAt: new Date().toISOString(),
  };
  await commitWithRetry(
    [
      writeOf(collection, options.id, next, {
        updateTime: record._updateTime ? String(record._updateTime) : undefined,
      }),
    ],
    options.idToken
  );
  await auditWarehouse(options.idToken, options.session, {
    action: "WORKFLOW",
    resource: collection,
    resourceId: options.id,
    description,
    oldData: { status: record.status },
    newData: { status: nextStatus },
    reason: options.reason,
  });
  if (nextStatus === "requested" || nextStatus === "approved") {
    await notifyWarehouse(options.idToken, options.session, {
      type: nextStatus === "requested" ? "approval_pending" : "transfer_pending",
      title: nextStatus === "requested" ? "Approval pending" : "Transfer pending",
      message: description,
      resource: collection,
      resourceId: options.id,
      severity: "warning",
    });
  }
  return { id: options.id, record: next };
}

async function completeStockTransfer(
  id: string,
  transfer: Record<string, unknown> & { _updateTime?: string },
  session: SessionPayload,
  idToken: string,
  reason?: string
) {
  const items = await queryMasterDocuments(INVENTORY_COLLECTIONS.transferItems, idToken, {
    filters: [{ field: "transferId", value: id }],
    limit: 100,
  });
  if (!items.length) fail("Transfer has no items.");
  const writes: AtomicWrite[] = [];
  for (const item of items) {
    const sourceKey =
      text(item.balanceId) ||
      balanceKey({
        itemType: text(item.itemType || "material"),
        itemId: text(item.materialId || item.productId || item.itemId),
        batchNumber: text(item.batchNumber),
        warehouseId: text(transfer.fromWarehouseId),
        locationId: text(transfer.fromLocationId),
        qualityStatus: text(item.qualityStatus || "approved"),
      });
    const source = await readBalanceByKey(sourceKey, idToken);
    if (!source) fail("Source inventory balance was not found.");
    const qty = roundQuantity(item.quantity);
    const sourceSnap = snapshotFromBalance(source);
    const destSnap = snapshotFromBalance(source, {
      warehouseId: text(transfer.toWarehouseId),
      locationId: text(transfer.toLocationId),
    });
    const out = await applyBalanceDelta({ snapshot: sourceSnap, delta: -qty, session, idToken });
    const incoming = await applyBalanceDelta({ snapshot: destSnap, delta: qty, session, idToken });
    writes.push(out.write, incoming.write);
    writes.push(
      (
        await createLedgerWrite({
          session,
          idToken,
          draft: {
            type: "TRANSFER_OUT",
            quantityIn: 0,
            quantityOut: qty,
            balanceAfter: roundQuantity(out.record.availableQuantity),
            referenceType: INVENTORY_COLLECTIONS.transfers,
            referenceId: id,
            remarks: text(transfer.reason),
            snapshot: sourceSnap,
          },
        })
      ).write
    );
    writes.push(
      (
        await createLedgerWrite({
          session,
          idToken,
          draft: {
            type: "TRANSFER_IN",
            quantityIn: qty,
            quantityOut: 0,
            balanceAfter: roundQuantity(incoming.record.availableQuantity),
            referenceType: INVENTORY_COLLECTIONS.transfers,
            referenceId: id,
            remarks: text(transfer.reason),
            snapshot: destSnap,
          },
        })
      ).write
    );
    if (text(source.inventoryBatchId)) {
      writes.push(
        traceabilityWrite({
          inventoryBatchId: text(source.inventoryBatchId),
          batchNumber: sourceSnap.batchNumber,
          eventType: "TRANSFER",
          title: "Stock transferred",
          detail: `${qty} ${sourceSnap.uom} moved to a new warehouse location.`,
          referenceType: INVENTORY_COLLECTIONS.transfers,
          referenceId: id,
          session,
        })
      );
    }
  }
  const next = {
    ...transfer,
    status: "completed",
    completedBy: session.uid,
    updatedBy: session.uid,
    updatedAt: new Date().toISOString(),
  };
  writes.push(
    writeOf(INVENTORY_COLLECTIONS.transfers, id, next, {
      updateTime: transfer._updateTime ? String(transfer._updateTime) : undefined,
    })
  );
  await commitWithRetry(writes, idToken);
  await auditWarehouse(idToken, session, {
    action: "TRANSFER",
    resource: INVENTORY_COLLECTIONS.transfers,
    resourceId: id,
    description: `Completed stock transfer ${text(transfer.transferNumber)}.`,
    oldData: { status: transfer.status },
    newData: { status: "completed" },
    reason,
  });
  return { id, record: next };
}

export async function saveStockIssue(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "stockIssue:create");
  const data = parseOrFail(stockIssueSchema, options.payload);
  await requireActiveMaster("warehouses", data.warehouseId, options.idToken, "Warehouse");
  if (data.locationId) await requireLocation(data.warehouseId, data.locationId, options.idToken);
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;

  const issueId = crypto.randomUUID();
  const numbered = await issueWarehouseNumber("ISS", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  const items: Record<string, unknown>[] = [];
  for (const item of data.items) {
    const itemId = crypto.randomUUID();
    const record = {
      issueItemId: itemId,
      issueId,
      ...item,
      warehouseId: data.warehouseId,
      locationId: data.locationId || "",
      quantity: roundQuantity(item.quantity),
      ...actorStamp(options.session),
    };
    items.push(record);
    writes.push(writeOf(INVENTORY_COLLECTIONS.issueItems, itemId, record, { exists: false }));
  }
  const issue = {
    issueId,
    issueNumber: numbered.documentNumber,
    warehouseId: data.warehouseId,
    locationId: data.locationId || "",
    issuedTo: data.issuedTo || "",
    department: data.department || "",
    referenceType: data.referenceType || "",
    referenceId: data.referenceId || "",
    remarks: data.remarks || "",
    issuedBy: "",
    verifiedBy: "",
    status: "draft",
    searchIndex: searchIndex(numbered.documentNumber, data.issuedTo, data.department),
    nameIndex: numbered.documentNumber.toLowerCase(),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(INVENTORY_COLLECTIONS.issues, issueId, issue, { exists: false }));
  if (data.idempotencyKey) {
    writes.push(idempotencyWrite(data.idempotencyKey, { id: issueId, record: issue }, options.session));
  }
  await commitWithRetry(writes, options.idToken);
  await auditWarehouse(options.idToken, options.session, {
    action: "CREATE",
    resource: INVENTORY_COLLECTIONS.issues,
    resourceId: issueId,
    description: `Created material issue ${numbered.documentNumber}.`,
    newData: { issueNumber: numbered.documentNumber, status: "draft" },
  });
  return { id: issueId, record: issue, items };
}

export async function transitionStockIssue(options: {
  id: string;
  action: "request" | "approve" | "complete" | "cancel";
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  const issue = await requireRecord(INVENTORY_COLLECTIONS.issues, options.id, options.idToken, "Material issue");
  const status = text(issue.status);
  if (options.action === "cancel") {
    return cancelWarehouseDocument({
      collection: INVENTORY_COLLECTIONS.issues,
      id: options.id,
      session: options.session,
      idToken: options.idToken,
      allowedFrom: ["draft", "requested"],
      permission: "stockIssue:create",
      reason: options.reason,
    });
  }
  if (options.action === "request") {
    ensurePermission(options.session, "stockIssue:create");
    if (status !== "draft") workflowFail(status, "request");
    return patchStatus(INVENTORY_COLLECTIONS.issues, issue, "requested", options, "Requested material issue.");
  }
  if (options.action === "approve") {
    ensurePermission(options.session, "stockIssue:approve");
    if (status !== "requested") workflowFail(status, "approve");
    return patchStatus(
      INVENTORY_COLLECTIONS.issues,
      { ...issue, verifiedBy: options.session.uid },
      "approved",
      options,
      "Approved material issue."
    );
  }
  if (options.action === "complete") {
    ensurePermission(options.session, "stockIssue:complete");
    if (status !== "approved") workflowFail(status, "issue");
    return completeStockIssue(options.id, issue, options.session, options.idToken, options.reason);
  }
  fail("Unknown issue action.");
}

async function completeStockIssue(
  id: string,
  issue: Record<string, unknown> & { _updateTime?: string },
  session: SessionPayload,
  idToken: string,
  reason?: string
) {
  const items = await queryMasterDocuments(INVENTORY_COLLECTIONS.issueItems, idToken, {
    filters: [{ field: "issueId", value: id }],
    limit: 100,
  });
  if (!items.length) fail("Issue has no items.");
  const writes: AtomicWrite[] = [];
  for (const item of items) {
    const allocations = await resolveIssueAllocations(item, issue, idToken);
    for (const allocation of allocations) {
      const block = issueBlockReason(allocation);
      if (block) fail(block);
      assertNotExpiredForIssue(allocation.expiryDate);
      const snap = snapshotFromBalance(allocation as unknown as Record<string, unknown>);
      const qty = roundQuantity(allocation.allocatedQuantity);
      const applied = await applyBalanceDelta({ snapshot: snap, delta: -qty, session, idToken });
      writes.push(applied.write);
      writes.push(
        (
          await createLedgerWrite({
            session,
            idToken,
            draft: {
              type: "ISSUE",
              quantityIn: 0,
              quantityOut: qty,
              balanceAfter: roundQuantity(applied.record.availableQuantity),
              referenceType: INVENTORY_COLLECTIONS.issues,
              referenceId: id,
              remarks: text(issue.remarks),
              snapshot: snap,
            },
          })
        ).write
      );
      if (snap.inventoryBatchId) {
        writes.push(
          traceabilityWrite({
            inventoryBatchId: snap.inventoryBatchId,
            batchNumber: snap.batchNumber,
            eventType: "ISSUE",
            title: "Material issued",
            detail: `${qty} ${snap.uom} issued${issue.issuedTo ? ` to ${text(issue.issuedTo)}` : ""}.`,
            referenceType: INVENTORY_COLLECTIONS.issues,
            referenceId: id,
            session,
          })
        );
      }
    }
  }
  const next = {
    ...issue,
    status: "issued",
    issuedBy: session.uid,
    updatedBy: session.uid,
    updatedAt: new Date().toISOString(),
  };
  writes.push(
    writeOf(INVENTORY_COLLECTIONS.issues, id, next, {
      updateTime: issue._updateTime ? String(issue._updateTime) : undefined,
    })
  );
  await commitWithRetry(writes, idToken);
  await auditWarehouse(idToken, session, {
    action: "ISSUE",
    resource: INVENTORY_COLLECTIONS.issues,
    resourceId: id,
    description: `Issued ${text(issue.issueNumber)}.`,
    oldData: { status: issue.status },
    newData: { status: "issued" },
    reason,
  });
  return { id, record: next };
}

async function resolveIssueAllocations(
  item: Record<string, unknown>,
  issue: Record<string, unknown>,
  idToken: string
) {
  if (text(item.balanceId)) {
    const balance = await readBalanceByKey(text(item.balanceId), idToken);
    if (!balance) fail("Inventory balance was not found.");
    return [{ ...balance, allocatedQuantity: roundQuantity(item.quantity) } as FefoCandidate & { allocatedQuantity: number }];
  }
  const itemId = text(item.materialId || item.productId || item.itemId);
  const rows = await queryMasterDocuments(INVENTORY_COLLECTIONS.balances, idToken, {
    filters: [
      { field: "itemId", value: itemId },
      { field: "qualityStatus", value: "approved" },
      { field: "warehouseId", value: text(issue.warehouseId) },
    ],
    limit: 100,
  });
  const selection = selectFefoBatches(
    rows.map((row) => ({
      id: String(row.id),
      inventoryBatchId: text(row.inventoryBatchId),
      itemId: text(row.itemId),
      itemType: text(row.itemType),
      batchNumber: text(row.batchNumber),
      lotNumber: text(row.lotNumber),
      warehouseId: text(row.warehouseId),
      locationId: text(row.locationId),
      qualityStatus: text(row.qualityStatus),
      inventoryStatus: text(row.inventoryStatus),
      availableQuantity: roundQuantity(row.availableQuantity),
      expiryDate: text(row.expiryDate) || null,
      uom: text(row.uom),
    })),
    roundQuantity(item.quantity),
    {
      warehouseId: text(issue.warehouseId),
      locationId: text(item.locationId || issue.locationId) || undefined,
      batchNumber: text(item.batchNumber) || undefined,
    }
  );
  if (selection.remainingQuantity > 0) fail("Insufficient approved stock for FEFO allocation.");
  return selection.allocations;
}

export async function saveStockReturn(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "stockReturn:create");
  const data = parseOrFail(stockReturnSchema, options.payload);
  await requireRecord(INVENTORY_COLLECTIONS.issues, data.originalIssueId, options.idToken, "Original issue");
  await requireLocation(data.warehouseId, data.locationId, options.idToken);
  if (data.qualityStatus === "approved") {
    fail("Returned material cannot automatically become approved.");
  }
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const returnId = crypto.randomUUID();
  const numbered = await issueWarehouseNumber("RET", options.session, options.idToken);
  const writes: AtomicWrite[] = [];
  for (const item of data.items) {
    const itemId = crypto.randomUUID();
    writes.push(
      writeOf(
        INVENTORY_COLLECTIONS.returnItems,
        itemId,
        {
          returnItemId: itemId,
          returnId,
          originalIssueId: data.originalIssueId,
          ...item,
          batchNumber: normalizeBatchNumber(item.batchNumber),
          quantity: roundQuantity(item.quantity),
          ...actorStamp(options.session),
        },
        { exists: false }
      )
    );
  }
  const record = {
    returnId,
    returnNumber: numbered.documentNumber,
    originalIssueId: data.originalIssueId,
    warehouseId: data.warehouseId,
    locationId: data.locationId,
    returnReason: data.returnReason,
    qualityStatus: data.qualityStatus,
    remarks: data.remarks || "",
    returnedBy: options.session.uid,
    verifiedBy: "",
    status: "draft",
    searchIndex: searchIndex(numbered.documentNumber, data.originalIssueId),
    nameIndex: numbered.documentNumber.toLowerCase(),
    ...actorStamp(options.session),
  };
  writes.push(writeOf(INVENTORY_COLLECTIONS.returns, returnId, record, { exists: false }));
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id: returnId, record }, options.session));
  await commitWithRetry(writes, options.idToken);
  await auditWarehouse(options.idToken, options.session, {
    action: "CREATE",
    resource: INVENTORY_COLLECTIONS.returns,
    resourceId: returnId,
    description: `Created material return ${numbered.documentNumber}.`,
    newData: { returnNumber: numbered.documentNumber, status: "draft" },
    reason: data.returnReason,
  });
  return { id: returnId, record };
}

export async function transitionStockReturn(options: {
  id: string;
  action: "request" | "receive" | "verify" | "complete" | "reject";
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  const record = await requireRecord(INVENTORY_COLLECTIONS.returns, options.id, options.idToken, "Material return");
  const status = text(record.status);
  if (options.action === "request") {
    ensurePermission(options.session, "stockReturn:create");
    if (status !== "draft") workflowFail(status, "request");
    return patchStatus(INVENTORY_COLLECTIONS.returns, record, "requested", options, "Requested material return.");
  }
  if (options.action === "receive") {
    ensurePermission(options.session, "stockReturn:create");
    if (status !== "requested") workflowFail(status, "receive");
    return patchStatus(INVENTORY_COLLECTIONS.returns, record, "received", options, "Received material return.");
  }
  if (options.action === "verify") {
    ensurePermission(options.session, "stockReturn:verify");
    if (status !== "received") workflowFail(status, "verify");
    return patchStatus(
      INVENTORY_COLLECTIONS.returns,
      { ...record, verifiedBy: options.session.uid },
      "verified",
      options,
      "Verified material return."
    );
  }
  if (options.action === "reject") {
    ensurePermission(options.session, "stockReturn:verify");
    if (!["requested", "received", "verified"].includes(status)) workflowFail(status, "reject");
    return patchStatus(INVENTORY_COLLECTIONS.returns, record, "rejected", options, "Rejected material return.");
  }
  if (options.action === "complete") {
    ensurePermission(options.session, "stockReturn:verify");
    if (status !== "verified") workflowFail(status, "complete");
    return completeStockReturn(options.id, record, options.session, options.idToken, options.reason);
  }
  fail("Unknown return action.");
}

async function completeStockReturn(
  id: string,
  record: Record<string, unknown> & { _updateTime?: string },
  session: SessionPayload,
  idToken: string,
  reason?: string
) {
  const items = await queryMasterDocuments(INVENTORY_COLLECTIONS.returnItems, idToken, {
    filters: [{ field: "returnId", value: id }],
    limit: 100,
  });
  const writes: AtomicWrite[] = [];
  const quality = text(record.qualityStatus || "returned");
  if (quality === "approved") fail("Returned material cannot automatically become approved.");
  for (const item of items) {
    const resolved = await resolveItem({
      itemType: text(item.itemType || "material"),
      materialId: text(item.materialId),
      productId: text(item.productId),
      idToken,
    });
    const snapshot: StockSnapshot = {
      itemType: resolved.itemType,
      itemId: resolved.itemId,
      itemCode: resolved.itemCode,
      itemName: resolved.itemName,
      materialId: resolved.materialId,
      productId: resolved.productId,
      batchNumber: normalizeBatchNumber(item.batchNumber),
      warehouseId: text(record.warehouseId),
      locationId: text(record.locationId),
      qualityStatus: quality,
      inventoryStatus: inventoryStatusForQuality(quality),
      uom: text(item.uom || resolved.uom),
      inventoryBatchId: text(item.inventoryBatchId),
    };
    const qty = roundQuantity(item.quantity);
    const applied = await applyBalanceDelta({ snapshot, delta: qty, session, idToken });
    writes.push(applied.write);
    writes.push(
      (
        await createLedgerWrite({
          session,
          idToken,
          draft: {
            type: "RETURN",
            quantityIn: qty,
            quantityOut: 0,
            balanceAfter: roundQuantity(applied.record.availableQuantity),
            referenceType: INVENTORY_COLLECTIONS.returns,
            referenceId: id,
            remarks: text(record.returnReason),
            snapshot,
          },
        })
      ).write
    );
  }
  const next = {
    ...record,
    status: "completed",
    updatedBy: session.uid,
    updatedAt: new Date().toISOString(),
  };
  writes.push(
    writeOf(INVENTORY_COLLECTIONS.returns, id, next, {
      updateTime: record._updateTime ? String(record._updateTime) : undefined,
    })
  );
  await commitWithRetry(writes, idToken);
  await auditWarehouse(idToken, session, {
    action: "RETURN",
    resource: INVENTORY_COLLECTIONS.returns,
    resourceId: id,
    description: `Completed material return ${text(record.returnNumber)}.`,
    oldData: { status: record.status },
    newData: { status: "completed", qualityStatus: quality },
    reason,
  });
  return { id, record: next };
}

export async function saveStockAdjustment(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "stockAdjustment:create");
  const data = parseOrFail(stockAdjustmentSchema, options.payload);
  const balance = await readBalanceByKey(data.balanceId, options.idToken);
  if (!balance) fail("Inventory balance was not found.");
  const reused = await reuseIdempotent(data.idempotencyKey, options.idToken);
  if (reused) return reused;
  const adjustmentId = crypto.randomUUID();
  const numbered = await issueWarehouseNumber("ADJ", options.session, options.idToken);
  const previous = roundQuantity(balance.availableQuantity);
  const adjusted = roundQuantity(data.adjustedQuantity);
  const record = {
    adjustmentId,
    adjustmentNumber: numbered.documentNumber,
    inventoryBatchId: text(balance.inventoryBatchId),
    balanceId: data.balanceId,
    previousQuantity: previous,
    adjustedQuantity: adjusted,
    difference: roundQuantity(adjusted - previous),
    reason: data.reason,
    remarks: data.remarks || "",
    requestedBy: options.session.uid,
    approvedBy: "",
    status: "draft",
    searchIndex: searchIndex(numbered.documentNumber, data.reason, balance.batchNumber),
    nameIndex: numbered.documentNumber.toLowerCase(),
    ...actorStamp(options.session),
  };
  const writes = [writeOf(INVENTORY_COLLECTIONS.adjustments, adjustmentId, record, { exists: false })];
  if (data.idempotencyKey) writes.push(idempotencyWrite(data.idempotencyKey, { id: adjustmentId, record }, options.session));
  await commitWithRetry(writes, options.idToken);
  await auditWarehouse(options.idToken, options.session, {
    action: "CREATE",
    resource: INVENTORY_COLLECTIONS.adjustments,
    resourceId: adjustmentId,
    description: `Created stock adjustment ${numbered.documentNumber}.`,
    newData: { adjustmentNumber: numbered.documentNumber, status: "draft" },
    reason: data.reason,
  });
  await notifyWarehouse(options.idToken, options.session, {
    type: "adjustment_approval_required",
    title: "Adjustment approval required",
    message: `${numbered.documentNumber} is waiting for approval.`,
    resource: INVENTORY_COLLECTIONS.adjustments,
    resourceId: adjustmentId,
    severity: "warning",
    audienceRoles: ["qa", "department_head"],
  });
  return { id: adjustmentId, record };
}

export async function transitionStockAdjustment(options: {
  id: string;
  action: "request" | "approve" | "cancel";
  session: SessionPayload;
  idToken: string;
  reason?: string;
}) {
  const record = await requireRecord(INVENTORY_COLLECTIONS.adjustments, options.id, options.idToken, "Stock adjustment");
  const status = text(record.status);
  if (options.action === "cancel") {
    return cancelWarehouseDocument({
      collection: INVENTORY_COLLECTIONS.adjustments,
      id: options.id,
      session: options.session,
      idToken: options.idToken,
      allowedFrom: ["draft", "requested"],
      permission: "stockAdjustment:create",
      reason: options.reason,
    });
  }
  if (options.action === "request") {
    ensurePermission(options.session, "stockAdjustment:create");
    if (status !== "draft") workflowFail(status, "request");
    return patchStatus(INVENTORY_COLLECTIONS.adjustments, record, "requested", options, "Requested stock adjustment.");
  }
  if (options.action === "approve") {
    ensurePermission(options.session, "stockAdjustment:approve");
    if (status !== "requested") workflowFail(status, "approve");
    return completeStockAdjustment(options.id, record, options.session, options.idToken, options.reason);
  }
  fail("Unknown adjustment action.");
}

async function completeStockAdjustment(
  id: string,
  record: Record<string, unknown> & { _updateTime?: string },
  session: SessionPayload,
  idToken: string,
  reason?: string
) {
  const balance = await readBalanceByKey(text(record.balanceId), idToken);
  if (!balance) fail("Inventory balance was not found.");
  const previous = roundQuantity(balance.availableQuantity);
  const adjusted = roundQuantity(record.adjustedQuantity);
  const delta = roundQuantity(adjusted - previous);
  const snapshot = snapshotFromBalance(balance);
  const applied = await applyBalanceDelta({ snapshot, delta, session, idToken });
  const ledger = await createLedgerWrite({
    session,
    idToken,
    draft: {
      type: delta >= 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
      quantityIn: delta > 0 ? delta : 0,
      quantityOut: delta < 0 ? Math.abs(delta) : 0,
      balanceAfter: roundQuantity(applied.record.availableQuantity),
      referenceType: INVENTORY_COLLECTIONS.adjustments,
      referenceId: id,
      remarks: text(record.reason),
      snapshot,
    },
  });
  const next = {
    ...record,
    previousQuantity: previous,
    difference: delta,
    status: "approved",
    approvedBy: session.uid,
    updatedBy: session.uid,
    updatedAt: new Date().toISOString(),
  };
  await commitWithRetry(
    [
      applied.write,
      ledger.write,
      writeOf(INVENTORY_COLLECTIONS.adjustments, id, next, {
        updateTime: record._updateTime ? String(record._updateTime) : undefined,
      }),
    ],
    idToken
  );
  await auditWarehouse(idToken, session, {
    action: "ADJUST",
    resource: INVENTORY_COLLECTIONS.adjustments,
    resourceId: id,
    description: `Approved stock adjustment ${text(record.adjustmentNumber)}.`,
    oldData: { quantity: previous },
    newData: { quantity: adjusted, difference: delta },
    reason,
  });
  return { id, record: next };
}

export async function transitionQuality(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  const data = parseOrFail(qualityTransitionSchema, options.payload);
  const needed = permissionForQualityTransition(data.nextQualityStatus);
  if (!hasAnyPermission(options.session.permissions, [needed, "inventory:release"])) {
    if (!hasPermission(options.session.permissions, needed)) {
      fail("You do not have permission to change this quality status.");
    }
  }
  if (data.nextQualityStatus === "approved") ensurePermission(options.session, "inventory:release");
  if (data.nextQualityStatus === "rejected") ensurePermission(options.session, "inventory:reject");
  if (data.nextQualityStatus === "blocked") ensurePermission(options.session, "inventory:block");

  const source = await readBalanceByKey(data.balanceId, options.idToken);
  if (!source) fail("Inventory balance was not found.");
  const current = text(source.qualityStatus);
  if (!canTransitionQuality(current, data.nextQualityStatus)) {
    fail(`Quality status cannot move from ${current} to ${data.nextQualityStatus}.`);
  }
  const qty = roundQuantity(data.quantity ?? source.availableQuantity);
  if (qty <= 0) fail("Quantity must be greater than zero.");
  if (qty - roundQuantity(source.availableQuantity) > 1e-9) fail("Quantity exceeds the available balance.");

  const sourceSnap = snapshotFromBalance(source);
  const destSnap = snapshotFromBalance(source, {
    qualityStatus: data.nextQualityStatus,
    inventoryStatus: inventoryStatusForQuality(data.nextQualityStatus),
  });
  const out = await applyBalanceDelta({ snapshot: sourceSnap, delta: -qty, session: options.session, idToken: options.idToken });
  const incoming = await applyBalanceDelta({
    snapshot: destSnap,
    delta: qty,
    session: options.session,
    idToken: options.idToken,
  });
  const ledgerType = qualityLedgerType(current, data.nextQualityStatus);
  const writes: AtomicWrite[] = [
    out.write,
    incoming.write,
    (
      await createLedgerWrite({
        session: options.session,
        idToken: options.idToken,
        draft: {
          type: ledgerType,
          quantityIn: 0,
          quantityOut: qty,
          balanceAfter: roundQuantity(out.record.availableQuantity),
          referenceType: "quality",
          referenceId: text(source.inventoryBatchId || data.balanceId),
          remarks: data.reason,
          snapshot: sourceSnap,
        },
      })
    ).write,
    (
      await createLedgerWrite({
        session: options.session,
        idToken: options.idToken,
        draft: {
          type: ledgerType,
          quantityIn: qty,
          quantityOut: 0,
          balanceAfter: roundQuantity(incoming.record.availableQuantity),
          referenceType: "quality",
          referenceId: text(source.inventoryBatchId || data.balanceId),
          remarks: data.reason,
          snapshot: destSnap,
        },
      })
    ).write,
    statusHistoryWrite({
      inventoryBatchId: text(source.inventoryBatchId),
      previousStatus: current,
      newStatus: data.nextQualityStatus,
      kind: "quality",
      reason: data.reason,
      reference: data.reference,
      session: options.session,
    }),
    traceabilityWrite({
      inventoryBatchId: text(source.inventoryBatchId),
      batchNumber: sourceSnap.batchNumber,
      eventType: ledgerType,
      title: `Quality ${current} → ${data.nextQualityStatus}`,
      detail: data.reason,
      referenceType: "quality",
      referenceId: data.balanceId,
      session: options.session,
    }),
  ];

  if (data.nextQualityStatus === "rejected") {
    const rejectionId = crypto.randomUUID();
    writes.push(
      writeOf(
        INVENTORY_COLLECTIONS.rejections,
        rejectionId,
        {
          rejectionId,
          inventoryBatchId: text(source.inventoryBatchId),
          balanceId: data.balanceId,
          reason: data.reason,
          quantity: qty,
          rejectedBy: options.session.uid,
          approvedBy: options.session.uid,
          date: new Date().toISOString(),
          disposition: data.disposition || "other",
          remarks: data.reference || "",
          ...actorStamp(options.session),
        },
        { exists: false }
      )
    );
  }

  if (source.inventoryBatchId) {
    const batch = await readMasterDocument(INVENTORY_COLLECTIONS.batches, text(source.inventoryBatchId), options.idToken);
    if (batch) {
      writes.push(
        writeOf(INVENTORY_COLLECTIONS.batches, String(batch.id), {
          ...batch,
          qualityStatus: data.nextQualityStatus,
          inventoryStatus: inventoryStatusForQuality(data.nextQualityStatus),
          rejectedQuantity:
            data.nextQualityStatus === "rejected"
              ? roundQuantity(Number(batch.rejectedQuantity || 0) + qty)
              : batch.rejectedQuantity,
          qcStatus: data.nextQualityStatus === "under_testing" ? "testing" : text(batch.qcStatus),
          qaStatus:
            data.nextQualityStatus === "approved"
              ? "released"
              : data.nextQualityStatus === "rejected"
                ? "rejected"
                : text(batch.qaStatus),
          updatedBy: options.session.uid,
          updatedAt: new Date().toISOString(),
        })
      );
    }
  }

  await commitWithRetry(writes, options.idToken);
  await auditWarehouse(options.idToken, options.session, {
    action: qualityAuditAction(data.nextQualityStatus),
    resource: INVENTORY_COLLECTIONS.balances,
    resourceId: data.balanceId,
    description: `Changed quality from ${current} to ${data.nextQualityStatus}.`,
    oldData: { qualityStatus: current, quantity: source.availableQuantity },
    newData: { qualityStatus: data.nextQualityStatus, quantity: qty },
    reason: data.reason,
  });
  return { id: String(incoming.record.id), record: incoming.record };
}

export async function saveInventoryDocument(options: {
  payload: Record<string, unknown>;
  session: SessionPayload;
  idToken: string;
}) {
  ensurePermission(options.session, "inventory:update");
  const data = parseOrFail(inventoryDocumentSchema, options.payload);
  await requireRecord(INVENTORY_COLLECTIONS.batches, data.inventoryBatchId, options.idToken, "Inventory batch");
  const id = crypto.randomUUID();
  const record = {
    documentId: id,
    ...data,
    ...actorStamp(options.session),
  };
  await commitWithRetry([writeOf(INVENTORY_COLLECTIONS.documents, id, record, { exists: false })], options.idToken);
  await auditWarehouse(options.idToken, options.session, {
    action: "CREATE",
    resource: INVENTORY_COLLECTIONS.documents,
    resourceId: id,
    description: `Uploaded inventory document ${data.title}.`,
    newData: { documentType: data.documentType, inventoryBatchId: data.inventoryBatchId },
  });
  return { id, record };
}

export async function selectFefoForItem(options: {
  itemId: string;
  quantity: number;
  warehouseId?: string;
  locationId?: string;
  batchNumber?: string;
  idToken: string;
}) {
  const filters = [
    { field: "itemId", value: options.itemId },
    { field: "qualityStatus", value: "approved" },
  ];
  if (options.warehouseId) filters.push({ field: "warehouseId", value: options.warehouseId });
  const rows = await queryMasterDocuments(INVENTORY_COLLECTIONS.balances, options.idToken, {
    filters,
    limit: 100,
  });
  return selectFefoBatches(
    rows.map((row) => ({
      id: String(row.id),
      inventoryBatchId: text(row.inventoryBatchId),
      itemId: text(row.itemId),
      itemType: text(row.itemType),
      batchNumber: text(row.batchNumber),
      lotNumber: text(row.lotNumber),
      warehouseId: text(row.warehouseId),
      locationId: text(row.locationId),
      qualityStatus: text(row.qualityStatus),
      inventoryStatus: text(row.inventoryStatus),
      availableQuantity: roundQuantity(row.availableQuantity),
      expiryDate: text(row.expiryDate) || null,
      uom: text(row.uom),
    })),
    options.quantity,
    {
      warehouseId: options.warehouseId,
      locationId: options.locationId,
      batchNumber: options.batchNumber,
    }
  );
}

export { buildBalanceRecord };
