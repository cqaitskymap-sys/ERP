import { z } from "zod";
import {
  ADJUSTMENT_REASONS,
  ADJUSTMENT_STATUSES,
  CONDITION_STATUSES,
  GOODS_RECEIPT_STATUSES,
  INVENTORY_DOCUMENT_TYPES,
  INVENTORY_ITEM_TYPES,
  INVENTORY_QUALITY_STATUSES,
  INVENTORY_STATUSES,
  REJECTION_DISPOSITIONS,
  RETURN_REASONS,
  VERIFICATION_STATUSES,
} from "@/types/inventory";

const optionalText = z.string().trim().optional().or(z.literal(""));
const quantity = z.coerce.number().positive("Quantity must be greater than zero.");

export const goodsReceiptItemSchema = z.object({
  materialId: optionalText,
  productId: optionalText,
  itemType: z.enum(INVENTORY_ITEM_TYPES).default("material"),
  batchNumber: z.string().trim().min(1, "Batch number is required."),
  lotNumber: optionalText,
  supplierBatchNumber: optionalText,
  manufacturerBatchNumber: optionalText,
  quantity,
  uom: z.string().trim().min(1, "UOM is required."),
  manufacturingDate: optionalText,
  expiryDate: optionalText,
  retestDate: optionalText,
  packageCount: z.coerce.number().min(0).optional(),
  packageCondition: z.enum(CONDITION_STATUSES).optional().or(z.literal("")),
  remarks: optionalText,
  purchaseOrderItemId: optionalText,
});

export const goodsReceiptSchema = z.object({
  receiptDate: z.string().trim().min(1, "Receipt date is required."),
  supplierId: optionalText,
  sourceReference: optionalText,
  purchaseOrderId: optionalText,
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  receivingLocationId: z.string().trim().min(1, "Receiving location is required."),
  itemType: z.enum(INVENTORY_ITEM_TYPES).default("material"),
  status: z.enum(GOODS_RECEIPT_STATUSES).optional(),
  remarks: optionalText,
  idempotencyKey: optionalText,
  items: z.array(goodsReceiptItemSchema).min(1, "Add at least one receipt item."),
});

export const receivingCheckSchema = z.object({
  quantityReceived: z.coerce.number().positive("Received quantity is required."),
  packageCount: z.coerce.number().min(0).optional(),
  packageCondition: z.enum(CONDITION_STATUSES).optional().or(z.literal("")),
  labelCondition: z.enum(CONDITION_STATUSES).optional().or(z.literal("")),
  sealCondition: z.enum(CONDITION_STATUSES).optional().or(z.literal("")),
  batchNumberConfirmed: z.boolean().default(true),
  expiryConfirmed: z.boolean().default(true),
  supplierConfirmed: z.boolean().default(true),
  materialIdentityConfirmed: z.boolean().default(true),
  documentationAvailable: z.boolean().default(true),
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  remarks: optionalText,
});

export const stockTransferItemSchema = z.object({
  inventoryBatchId: optionalText,
  balanceId: optionalText,
  itemType: z.enum(INVENTORY_ITEM_TYPES).default("material"),
  materialId: optionalText,
  productId: optionalText,
  batchNumber: z.string().trim().min(1, "Batch number is required."),
  lotNumber: optionalText,
  quantity,
  uom: z.string().trim().min(1, "UOM is required."),
  qualityStatus: z.enum(INVENTORY_QUALITY_STATUSES).optional(),
});

export const stockTransferSchema = z.object({
  fromWarehouseId: z.string().trim().min(1, "Source warehouse is required."),
  fromLocationId: z.string().trim().min(1, "Source location is required."),
  toWarehouseId: z.string().trim().min(1, "Destination warehouse is required."),
  toLocationId: z.string().trim().min(1, "Destination location is required."),
  reason: z.string().trim().min(2, "Transfer reason is required."),
  remarks: optionalText,
  idempotencyKey: optionalText,
  items: z.array(stockTransferItemSchema).min(1, "Add at least one transfer item."),
});

export const stockIssueItemSchema = z.object({
  inventoryBatchId: optionalText,
  balanceId: optionalText,
  materialId: optionalText,
  productId: optionalText,
  itemType: z.enum(INVENTORY_ITEM_TYPES).default("material"),
  batchNumber: optionalText,
  lotNumber: optionalText,
  quantity,
  uom: optionalText,
  useFefo: z.boolean().optional(),
});

export const stockIssueSchema = z.object({
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  locationId: optionalText,
  issuedTo: optionalText,
  department: optionalText,
  referenceType: optionalText,
  referenceId: optionalText,
  remarks: optionalText,
  idempotencyKey: optionalText,
  items: z.array(stockIssueItemSchema).min(1, "Add at least one issue item."),
});

export const stockReturnItemSchema = z.object({
  originalIssueId: optionalText,
  originalIssueItemId: optionalText,
  inventoryBatchId: optionalText,
  materialId: optionalText,
  productId: optionalText,
  itemType: z.enum(INVENTORY_ITEM_TYPES).default("material"),
  batchNumber: z.string().trim().min(1, "Batch number is required."),
  quantity,
  uom: z.string().trim().min(1, "UOM is required."),
});

export const stockReturnSchema = z.object({
  originalIssueId: z.string().trim().min(1, "Original issue is required."),
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  locationId: z.string().trim().min(1, "Location is required."),
  returnReason: z.enum(RETURN_REASONS),
  qualityStatus: z.enum(INVENTORY_QUALITY_STATUSES).default("returned"),
  remarks: optionalText,
  idempotencyKey: optionalText,
  items: z.array(stockReturnItemSchema).min(1, "Add at least one return item."),
});

export const stockAdjustmentSchema = z.object({
  inventoryBatchId: optionalText,
  balanceId: z.string().trim().min(1, "Inventory balance is required."),
  adjustedQuantity: z.coerce.number().min(0, "Adjusted quantity cannot be negative."),
  reason: z.enum(ADJUSTMENT_REASONS),
  remarks: optionalText,
  idempotencyKey: optionalText,
  status: z.enum(ADJUSTMENT_STATUSES).optional(),
});

export const qualityTransitionSchema = z.object({
  inventoryBatchId: optionalText,
  balanceId: z.string().trim().min(1, "Inventory balance is required."),
  quantity: quantity.optional(),
  nextQualityStatus: z.enum(INVENTORY_QUALITY_STATUSES),
  reason: z.string().trim().min(2, "A reason is required."),
  reference: optionalText,
  signature: optionalText,
  disposition: z.enum(REJECTION_DISPOSITIONS).optional(),
  idempotencyKey: optionalText,
});

export const inventoryDocumentSchema = z.object({
  inventoryBatchId: z.string().trim().min(1, "Batch is required."),
  documentType: z.enum(INVENTORY_DOCUMENT_TYPES),
  title: z.string().trim().min(2, "Document title is required."),
  storagePath: z.string().trim().min(1, "File path is required."),
  fileName: z.string().trim().min(1, "File name is required."),
  contentType: optionalText,
  fileSize: z.coerce.number().optional(),
  remarks: optionalText,
});

export const inventoryStatusUpdateSchema = z.object({
  nextStatus: z.enum(INVENTORY_STATUSES),
  reason: z.string().trim().min(2, "A reason is required."),
});

export const workflowActionSchema = z.object({
  action: z.string().trim().min(1, "Action is required."),
  reason: optionalText,
  remarks: optionalText,
  verification: receivingCheckSchema.optional(),
  idempotencyKey: optionalText,
  signature: optionalText,
});
