import { z } from "zod";
import {
  AMENDMENT_STATUSES,
  PO_STATUSES,
  PROCUREMENT_DOCUMENT_TYPES,
  PROCUREMENT_PRIORITIES,
  PR_STATUSES,
  QUOTATION_STATUSES,
  REQUIREMENT_SOURCES,
  REQUIREMENT_STATUSES,
  RFQ_STATUSES,
  SELECTION_REASONS,
} from "@/types/procurement";

const optionalText = z.string().trim().optional().or(z.literal(""));
const qty = z.coerce.number().positive("Quantity must be greater than zero.");
const moneyValue = z.coerce.number().min(0, "Amount cannot be negative.");

export const materialRequirementSchema = z.object({
  departmentId: optionalText,
  plantId: z.string().trim().min(1, "Plant is required."),
  requiredDate: z.string().trim().min(1, "Required date is required."),
  priority: z.enum(PROCUREMENT_PRIORITIES).default("normal"),
  purpose: z.string().trim().min(2, "Purpose is required."),
  source: z.enum(REQUIREMENT_SOURCES).default("manual"),
  status: z.enum(REQUIREMENT_STATUSES).optional(),
  remarks: optionalText,
  idempotencyKey: optionalText,
});

export const purchaseRequisitionItemSchema = z.object({
  materialId: z.string().trim().min(1, "Material is required."),
  description: optionalText,
  requiredQuantity: qty,
  uom: z.string().trim().min(1, "UOM is required."),
  requiredDate: optionalText,
  preferredVendorId: optionalText,
  specificationReference: optionalText,
  purpose: optionalText,
  remarks: optionalText,
});

export const purchaseRequisitionSchema = z.object({
  plantId: z.string().trim().min(1, "Plant is required."),
  departmentId: optionalText,
  requiredDate: z.string().trim().min(1, "Required date is required."),
  priority: z.enum(PROCUREMENT_PRIORITIES).default("normal"),
  purpose: z.string().trim().min(2, "Purpose is required."),
  requirementId: optionalText,
  remarks: optionalText,
  status: z.enum(PR_STATUSES).optional(),
  idempotencyKey: optionalText,
  items: z.array(purchaseRequisitionItemSchema).min(1, "Add at least one material line."),
});

export const rfqItemSchema = z.object({
  materialId: z.string().trim().min(1, "Material is required."),
  quantity: qty,
  uom: z.string().trim().min(1, "UOM is required."),
  requiredDate: optionalText,
  specificationReference: optionalText,
  remarks: optionalText,
});

export const rfqSchema = z.object({
  requisitionId: z.string().trim().min(1, "Approved purchase requisition is required."),
  plantId: optionalText,
  issueDate: optionalText,
  responseDueDate: z.string().trim().min(1, "Response due date is required."),
  currency: optionalText,
  remarks: optionalText,
  vendorIds: z.array(z.string().trim().min(1)).min(1, "Select at least one eligible vendor."),
  items: z.array(rfqItemSchema).optional(),
  idempotencyKey: optionalText,
  status: z.enum(RFQ_STATUSES).optional(),
});

export const vendorQuotationItemSchema = z.object({
  materialId: z.string().trim().min(1, "Material is required."),
  quotedQuantity: qty,
  uom: z.string().trim().min(1, "UOM is required."),
  unitPrice: moneyValue,
  discount: moneyValue.optional(),
  tax: moneyValue.optional(),
  freight: moneyValue.optional(),
  otherCharges: moneyValue.optional(),
  deliveryDays: z.coerce.number().min(0).optional(),
  specificationCompliance: z.enum(["yes", "no", "partial"]).default("yes"),
  remarks: optionalText,
});

export const vendorQuotationSchema = z.object({
  rfqId: z.string().trim().min(1, "RFQ is required."),
  vendorId: z.string().trim().min(1, "Vendor is required."),
  quotationDate: z.string().trim().min(1, "Quotation date is required."),
  validUntil: z.string().trim().min(1, "Validity date is required."),
  currency: optionalText,
  paymentTerms: optionalText,
  deliveryTerms: optionalText,
  freightTerms: optionalText,
  taxTerms: optionalText,
  leadTime: z.coerce.number().min(0).optional(),
  remarks: optionalText,
  idempotencyKey: optionalText,
  status: z.enum(QUOTATION_STATUSES).optional(),
  items: z.array(vendorQuotationItemSchema).min(1, "Add quotation lines."),
});

export const vendorSelectionSchema = z.object({
  rfqId: z.string().trim().min(1, "RFQ is required."),
  quotationId: z.string().trim().min(1, "Quotation is required."),
  vendorId: optionalText,
  selectionReason: z.enum(SELECTION_REASONS),
  remarks: optionalText,
  idempotencyKey: optionalText,
});

export const purchaseOrderItemSchema = z.object({
  materialId: z.string().trim().min(1, "Material is required."),
  description: optionalText,
  specificationReference: optionalText,
  orderedQuantity: qty,
  uom: z.string().trim().min(1, "UOM is required."),
  unitPrice: moneyValue,
  discount: moneyValue.optional(),
  tax: moneyValue.optional(),
  freight: moneyValue.optional(),
  otherCharges: moneyValue.optional(),
  expectedDeliveryDate: optionalText,
  warehouseId: optionalText,
  remarks: optionalText,
});

export const purchaseOrderSchema = z.object({
  vendorId: z.string().trim().min(1, "Vendor is required."),
  plantId: z.string().trim().min(1, "Plant is required."),
  warehouseId: optionalText,
  requisitionId: optionalText,
  rfqId: optionalText,
  quotationId: optionalText,
  selectionId: optionalText,
  poDate: z.string().trim().min(1, "PO date is required."),
  expectedDeliveryDate: z.string().trim().min(1, "Expected delivery date is required."),
  currency: optionalText,
  paymentTerms: optionalText,
  deliveryTerms: optionalText,
  freightTerms: optionalText,
  taxTerms: optionalText,
  overReceiptTolerancePercent: z.coerce.number().min(0).max(100).optional(),
  remarks: optionalText,
  status: z.enum(PO_STATUSES).optional(),
  idempotencyKey: optionalText,
  items: z.array(purchaseOrderItemSchema).min(1, "Add at least one PO line."),
});

export const purchaseOrderAmendmentSchema = z.object({
  purchaseOrderId: z.string().trim().min(1, "Purchase order is required."),
  reason: z.string().trim().min(2, "Amendment reason is required."),
  remarks: optionalText,
  expectedDeliveryDate: optionalText,
  paymentTerms: optionalText,
  deliveryTerms: optionalText,
  overReceiptTolerancePercent: z.coerce.number().min(0).max(100).optional(),
  items: z.array(purchaseOrderItemSchema).optional(),
  idempotencyKey: optionalText,
  status: z.enum(AMENDMENT_STATUSES).optional(),
});

export const procurementDocumentSchema = z.object({
  parentType: z.enum(["rfqs", "quotations", "purchaseOrders"]),
  parentId: z.string().trim().min(1, "Parent record is required."),
  documentType: z.enum(PROCUREMENT_DOCUMENT_TYPES),
  title: z.string().trim().min(2, "Document title is required."),
  storagePath: z.string().trim().min(1, "File path is required."),
  fileName: z.string().trim().min(1, "File name is required."),
  version: z.coerce.number().int().min(1).default(1),
  effectiveDate: optionalText,
  contentType: optionalText,
  fileSize: z.coerce.number().optional(),
  remarks: optionalText,
});

export const approvalActionSchema = z.object({
  action: z.enum(["approve", "reject", "return"]),
  comment: z.string().trim().optional(),
});
