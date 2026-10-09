import { z } from "zod";
import {
  CMO_STATUSES,
  COMMUNICATION_DELIVERY_STATUSES,
  COMMUNICATION_TYPES,
  CREDIT_REVIEW_STATUSES,
  PRICE_LIST_STATUSES,
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_STATUSES,
  RETURN_RESOLUTIONS,
  SALES_ORDER_TYPES,
  SALES_QUOTATION_STATUSES,
  SALES_RETURN_STATUSES,
} from "@/types/sales";

const optionalText = z.string().trim().optional().or(z.literal(""));
const moneyField = z.coerce.number().min(0).default(0);
const qtyField = z.coerce.number().positive("Quantity must be greater than zero.");

const lineItemSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  productCode: optionalText,
  productName: optionalText,
  packSize: optionalText,
  uom: optionalText,
  quantity: qtyField,
  unitPrice: moneyField,
  discount: moneyField,
  tax: moneyField,
  freight: moneyField,
  otherCharges: moneyField,
  moq: z.coerce.number().min(0).optional(),
  notes: optionalText,
});

export const salesPriceListSchema = z.object({
  customerId: optionalText,
  name: z.string().trim().min(2, "Price list name is required."),
  currency: z.string().trim().min(1).default("INR"),
  effectiveFrom: z.string().trim().min(1, "Effective from is required."),
  effectiveTo: optionalText,
  status: z.enum(PRICE_LIST_STATUSES).default("draft"),
  contractReference: optionalText,
  remarks: optionalText,
  idempotencyKey: optionalText,
  rules: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        packSize: optionalText,
        unitPrice: moneyField,
        currency: optionalText,
        minQuantity: z.coerce.number().min(0).default(0),
        maxQuantity: z.coerce.number().min(0).optional(),
        discountPercent: moneyField,
        taxPercent: moneyField,
        moq: z.coerce.number().min(0).optional(),
        effectiveFrom: optionalText,
        effectiveTo: optionalText,
      })
    )
    .default([]),
});

export const salesQuotationSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required."),
  quotationDate: z.string().trim().min(1, "Quotation date is required."),
  validUntil: z.string().trim().min(1, "Validity date is required."),
  currency: z.string().trim().min(1).default("INR"),
  paymentTerms: optionalText,
  deliveryTerms: optionalText,
  expectedDeliveryDate: optionalText,
  salesRepresentative: optionalText,
  customerRequirements: optionalText,
  internalNotes: optionalText,
  customerNotes: optionalText,
  priceListId: optionalText,
  status: z.enum(SALES_QUOTATION_STATUSES).optional(),
  idempotencyKey: optionalText,
  items: z.array(lineItemSchema).min(1, "At least one line item is required."),
});

export const salesOrderSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required."),
  orderType: z.enum(SALES_ORDER_TYPES).default("standard"),
  orderDate: z.string().trim().min(1, "Order date is required."),
  customerPoNumber: optionalText,
  quotationId: optionalText,
  contractOrderId: optionalText,
  currency: z.string().trim().min(1).default("INR"),
  paymentTerms: optionalText,
  deliveryAddress: optionalText,
  billingAddress: optionalText,
  requestedDeliveryDate: optionalText,
  promisedDeliveryDate: optionalText,
  regulatoryMarket: optionalText,
  requiredDocuments: optionalText,
  salesRepresentative: optionalText,
  customerRequirements: optionalText,
  internalNotes: optionalText,
  customerNotes: optionalText,
  warehouseId: optionalText,
  plantId: optionalText,
  creditOverrideReason: optionalText,
  idempotencyKey: optionalText,
  items: z.array(lineItemSchema).min(1, "At least one line item is required."),
});

export const contractManufacturingOrderSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required."),
  salesOrderId: optionalText,
  customerBrand: optionalText,
  customerProductReference: optionalText,
  productId: z.string().trim().min(1, "Product is required."),
  specificationId: optionalText,
  packagingRequirements: optionalText,
  artworkReference: optionalText,
  labelReference: optionalText,
  customerPoNumber: optionalText,
  manufacturingQuantity: qtyField,
  batchQuantity: z.coerce.number().min(0).optional(),
  customerProvidedMaterials: optionalText,
  bomId: optionalText,
  formulationReference: optionalText,
  manufacturingRequirements: optionalText,
  qualityAgreementId: optionalText,
  regulatoryMarket: optionalText,
  testingRequirements: optionalText,
  coaRequirements: optionalText,
  requiredBatchDocuments: optionalText,
  expectedProductionCompletion: optionalText,
  expectedDeliveryDate: optionalText,
  remarks: optionalText,
  status: z.enum(CMO_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const salesReturnSchema = z.object({
  salesOrderId: z.string().trim().min(1, "Sales order is required."),
  customerId: z.string().trim().min(1, "Customer is required."),
  shipmentId: optionalText,
  productId: z.string().trim().min(1, "Product is required."),
  batchNumber: optionalText,
  quantity: qtyField,
  reason: z.string().trim().min(2, "Return reason is required."),
  resolution: z.enum(RETURN_RESOLUTIONS).optional(),
  creditNoteReference: optionalText,
  refundReference: optionalText,
  status: z.enum(SALES_RETURN_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const salesRequirementSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required."),
  productId: optionalText,
  category: z.enum(REQUIREMENT_CATEGORIES),
  title: z.string().trim().min(2, "Title is required."),
  description: z.string().trim().min(2, "Description is required."),
  owner: optionalText,
  effectiveFrom: z.string().trim().min(1, "Effective date is required."),
  effectiveTo: optionalText,
  status: z.enum(REQUIREMENT_STATUSES).default("draft"),
  revision: z.coerce.number().min(1).default(1),
  linkedDocumentId: optionalText,
  affectsManufacturing: z.boolean().default(false),
  affectsQuality: z.boolean().default(false),
  affectsRegulatory: z.boolean().default(false),
  remarks: optionalText,
  idempotencyKey: optionalText,
});

export const salesCommunicationSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required."),
  relatedType: optionalText,
  relatedId: optionalText,
  communicationType: z.enum(COMMUNICATION_TYPES),
  subject: z.string().trim().min(2, "Subject is required."),
  body: z.string().trim().min(2, "Message body is required."),
  deliveryStatus: z.enum(COMMUNICATION_DELIVERY_STATUSES).default("recorded"),
  channel: optionalText,
  idempotencyKey: optionalText,
});

export const salesCreditReviewSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required."),
  salesOrderId: optionalText,
  requestedCreditLimit: moneyField.optional(),
  outstandingBalance: moneyField.optional(),
  reason: z.string().trim().min(2, "Reason is required."),
  overrideRequested: z.boolean().default(false),
  status: z.enum(CREDIT_REVIEW_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const salesReceivableSnapshotSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required."),
  creditLimit: moneyField,
  outstandingBalance: moneyField,
  overdueBalance: moneyField,
  currency: z.string().trim().min(1).default("INR"),
  invoiceReferences: optionalText,
  paymentReferences: optionalText,
  asOfDate: z.string().trim().min(1, "As-of date is required."),
  source: z.enum(["manual_reference", "finance_import", "external"]).default("manual_reference"),
  remarks: optionalText,
  idempotencyKey: optionalText,
});

export const salesDocumentSchema = z.object({
  parentType: z.string().trim().min(1),
  parentId: z.string().trim().min(1),
  documentType: z.string().trim().min(1),
  title: z.string().trim().min(1),
  storagePath: optionalText,
  version: z.coerce.number().min(1).default(1),
  remarks: optionalText,
});

export const salesSettingsSchema = z.object({
  discountApprovalThresholdPercent: z.coerce.number().min(0).default(5),
  financeReviewOrderValue: z.coerce.number().min(0).default(500000),
  creditUtilizationThresholdPercent: z.coerce.number().min(0).max(100).default(90),
  requireQaReviewForExport: z.boolean().default(true),
  requireRegulatoryReviewForExport: z.boolean().default(true),
  defaultCurrency: z.string().trim().min(1).default("INR"),
  defaultPaymentTerms: optionalText,
});

export const orderChangeSchema = z.object({
  field: z.string().trim().min(1),
  previousValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  reason: z.string().trim().min(2, "Change reason is required."),
  impactAssessment: optionalText,
});
