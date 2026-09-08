import { z } from "zod";
import {
  ASSIGNMENT_STATUSES,
  DEFAULT_SAMPLE_SOURCES,
  DISPOSITION_STATES,
  INSTRUMENT_STATUSES,
  OOS_STATUSES,
  OOT_STATUSES,
  QC_PRIORITIES,
  RESULT_OUTCOMES,
  SAMPLE_CONDITIONS,
  SAMPLE_REQUEST_STATUSES,
  SPEC_STATUSES,
  STABILITY_TIMEPOINTS,
  STANDARD_STATUSES,
  TEST_TYPES,
} from "@/types/qc";

const optionalText = z.string().trim().optional().or(z.literal(""));
const qty = z.coerce.number().positive("Quantity must be greater than zero.");

export const sampleRequestSchema = z.object({
  sourceType: z.string().trim().min(1, "Source type is required."),
  sourceRecordId: optionalText,
  plantId: optionalText,
  warehouseId: optionalText,
  productId: optionalText,
  materialId: optionalText,
  batchNumber: optionalText,
  vendorId: optionalText,
  goodsReceiptId: optionalText,
  manufacturingOrderId: optionalText,
  customerId: optionalText,
  priority: z.enum(QC_PRIORITIES).default("normal"),
  requiredDate: optionalText,
  remarks: optionalText,
  status: z.enum(SAMPLE_REQUEST_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const sampleSchema = z.object({
  sampleRequestId: optionalText,
  sampleType: optionalText,
  sourceType: z.string().trim().min(1, "Source type is required."),
  sourceRecordId: optionalText,
  productId: optionalText,
  materialId: optionalText,
  batchNumber: optionalText,
  vendorId: optionalText,
  goodsReceiptId: optionalText,
  manufacturingOrderId: optionalText,
  quantity: qty,
  uom: z.string().trim().min(1, "UOM is required."),
  containerCount: z.coerce.number().int().min(1).optional(),
  samplingLocation: optionalText,
  storageCondition: optionalText,
  remarks: optionalText,
  idempotencyKey: optionalText,
});

export const sampleReceiveSchema = z.object({
  receivedAt: optionalText,
  condition: z.enum(SAMPLE_CONDITIONS),
  containerIntegrity: optionalText,
  quantityReceived: z.coerce.number().positive().optional(),
  storageCondition: optionalText,
  remarks: optionalText,
  disposition: optionalText,
});

export const testRequestSchema = z.object({
  sampleId: z.string().trim().min(1, "Sample is required."),
  specificationId: optionalText,
  productId: optionalText,
  materialId: optionalText,
  batchNumber: optionalText,
  priority: z.enum(QC_PRIORITIES).default("normal"),
  dueDate: optionalText,
  remarks: optionalText,
  idempotencyKey: optionalText,
});

export const assignmentSchema = z.object({
  testRequestId: z.string().trim().min(1, "Test request is required."),
  testId: optionalText,
  analystId: z.string().trim().min(1, "Analyst is required."),
  dueDate: optionalText,
  priority: z.enum(QC_PRIORITIES).default("normal"),
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
});

export const specificationItemSchema = z.object({
  parameterName: z.string().trim().min(1, "Parameter is required."),
  testType: z.enum(TEST_TYPES).default("numeric"),
  unit: optionalText,
  target: optionalText,
  minimum: optionalText,
  maximum: optionalText,
  acceptanceCriteria: optionalText,
  sequence: z.coerce.number().int().min(1).optional(),
  mandatory: z.boolean().optional(),
  testMethodId: optionalText,
  calculation: optionalText,
});

export const specificationSchema = z.object({
  productId: optionalText,
  materialId: optionalText,
  effectiveDate: z.string().trim().min(1, "Effective date is required."),
  expiryDate: optionalText,
  remarks: optionalText,
  idempotencyKey: optionalText,
  items: z.array(specificationItemSchema).min(1, "Add at least one parameter."),
});

export const testMethodSchema = z.object({
  methodName: z.string().trim().min(2, "Method name is required."),
  effectiveDate: z.string().trim().min(1, "Effective date is required."),
  expiryDate: optionalText,
  description: optionalText,
  referenceStandard: optionalText,
  remarks: optionalText,
  status: z.enum(SPEC_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const resultLineSchema = z.object({
  parameterId: z.string().trim().min(1, "Parameter is required."),
  parameterName: z.string().trim().min(1, "Parameter name is required."),
  testType: z.enum(TEST_TYPES),
  unit: optionalText,
  target: optionalText,
  minimum: optionalText,
  maximum: optionalText,
  acceptanceCriteria: optionalText,
  mandatory: z.boolean().optional(),
  testMethodId: optionalText,
  instrumentId: optionalText,
  standardId: optionalText,
  enteredResult: optionalText,
  calculatedResult: optionalText,
  remarks: optionalText,
});

export const recordResultsSchema = z.object({
  testId: z.string().trim().min(1, "Test is required."),
  instrumentId: optionalText,
  standardId: optionalText,
  reason: optionalText,
  lines: z.array(resultLineSchema).min(1, "Enter at least one result."),
  idempotencyKey: optionalText,
});

export const oosSchema = z.object({
  testRequestId: optionalText,
  testId: optionalText,
  sampleId: optionalText,
  batchNumber: optionalText,
  parameter: z.string().trim().min(1, "Parameter is required."),
  observedResult: z.string().trim().min(1, "Observed result is required."),
  specification: optionalText,
  severity: z.enum(["minor", "major", "critical"]).default("major"),
  description: z.string().trim().min(2, "Description is required."),
  remarks: optionalText,
  status: z.enum(OOS_STATUSES).optional(),
});

export const ootSchema = z.object({
  sampleId: optionalText,
  testId: optionalText,
  batchNumber: optionalText,
  parameter: z.string().trim().min(1, "Parameter is required."),
  currentResult: z.string().trim().min(1, "Current result is required."),
  historicalTrend: optionalText,
  remarks: optionalText,
  status: z.enum(OOT_STATUSES).optional(),
});

export const retestSchema = z.object({
  originalTestId: z.string().trim().min(1, "Original test is required."),
  reason: z.string().trim().min(2, "Reason is required."),
  analystId: optionalText,
});

export const resamplingSchema = z.object({
  originalSampleId: z.string().trim().min(1, "Original sample is required."),
  reason: z.string().trim().min(2, "Reason is required."),
  quantity: qty,
  uom: z.string().trim().min(1, "UOM is required."),
});

export const dispositionSchema = z.object({
  testRequestId: optionalText,
  sampleId: optionalText,
  manufacturingOrderId: optionalText,
  inventoryBatchId: optionalText,
  batchNumber: optionalText,
  productId: optionalText,
  materialId: optionalText,
  disposition: z.enum(DISPOSITION_STATES),
  remarks: optionalText,
  reason: optionalText,
});

export const instrumentSchema = z.object({
  instrumentCode: z.string().trim().min(2, "Code is required."),
  instrumentName: z.string().trim().min(2, "Name is required."),
  instrumentType: optionalText,
  manufacturer: optionalText,
  model: optionalText,
  serialNumber: optionalText,
  location: optionalText,
  calibrationStatus: optionalText,
  calibrationDueDate: optionalText,
  qualificationStatus: optionalText,
  status: z.enum(INSTRUMENT_STATUSES).default("active"),
});

export const standardSchema = z.object({
  standardCode: z.string().trim().min(2, "Code is required."),
  name: z.string().trim().min(2, "Name is required."),
  lotNumber: optionalText,
  potency: optionalText,
  expiryDate: optionalText,
  storageCondition: optionalText,
  quantity: z.coerce.number().min(0).optional(),
  uom: optionalText,
  status: z.enum(STANDARD_STATUSES).default("available"),
});

export const stabilitySchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  batchNumber: z.string().trim().min(1, "Batch number is required."),
  condition: z.string().trim().min(1, "Condition is required."),
  protocol: optionalText,
  startDate: z.string().trim().min(1, "Start date is required."),
  frequency: optionalText,
  timepoints: z.array(z.enum(STABILITY_TIMEPOINTS)).optional(),
});

export const qcDocumentSchema = z.object({
  parentType: z.enum(["samples", "tests", "coa", "oos"]),
  parentId: z.string().trim().min(1, "Parent is required."),
  fileName: z.string().trim().min(1, "File name is required."),
  storagePath: z.string().trim().min(1, "Storage path is required."),
  contentType: optionalText,
  remarks: optionalText,
});

export const sourceTypeHint = DEFAULT_SAMPLE_SOURCES;
export const resultOutcomeHint = RESULT_OUTCOMES;
