import { z } from "zod";
import {
  BATCH_PLAN_STATUSES,
  BMR_STATUSES,
  BOM_STATUSES,
  DEVIATION_SEVERITIES,
  DEVIATION_STATUSES,
  DISPENSING_STATUSES,
  IPC_RESULTS,
  MATERIAL_STAGES,
  MO_STATUSES,
  PLAN_STATUSES,
  PRODUCTION_PRIORITIES,
  RECON_STATUSES,
  ROUNDING_RULES,
  SCHEDULE_STATUSES,
  WASTAGE_REASONS,
  WORK_CENTER_TYPES,
} from "@/types/production";

const optionalText = z.string().trim().optional().or(z.literal(""));
const qty = z.coerce.number().positive("Quantity must be greater than zero.");

export const productionPlanItemSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  customerId: optionalText,
  quantity: qty,
  uom: z.string().trim().min(1, "UOM is required."),
  targetDate: optionalText,
  priority: z.enum(PRODUCTION_PRIORITIES).default("normal"),
  batchSize: z.coerce.number().positive().optional(),
  numberOfBatches: z.coerce.number().int().min(0).optional(),
  remarks: optionalText,
});

export const productionPlanSchema = z.object({
  plantId: z.string().trim().min(1, "Plant is required."),
  departmentId: optionalText,
  productionPeriod: z.string().trim().min(1, "Production period is required."),
  priority: z.enum(PRODUCTION_PRIORITIES).default("normal"),
  customerId: optionalText,
  productId: optionalText,
  plannedQuantity: z.coerce.number().min(0).optional(),
  uom: optionalText,
  targetDate: z.string().trim().min(1, "Target date is required."),
  requestedDate: optionalText,
  planningNotes: optionalText,
  status: z.enum(PLAN_STATUSES).optional(),
  idempotencyKey: optionalText,
  items: z.array(productionPlanItemSchema).min(1, "Add at least one product line."),
});

export const productionScheduleSchema = z.object({
  productionPlanId: optionalText,
  productId: z.string().trim().min(1, "Product is required."),
  batchSize: qty,
  plannedStartDate: z.string().trim().min(1, "Planned start is required."),
  plannedEndDate: z.string().trim().min(1, "Planned end is required."),
  workCenterId: optionalText,
  priority: z.enum(PRODUCTION_PRIORITIES).default("normal"),
  assignedSupervisor: optionalText,
  remarks: optionalText,
  status: z.enum(SCHEDULE_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const batchPlanSchema = z.object({
  productionPlanId: optionalText,
  productId: z.string().trim().min(1, "Product is required."),
  batchSize: qty,
  requiredQuantity: qty,
  uom: z.string().trim().min(1, "UOM is required."),
  targetYield: z.coerce.number().min(0).optional(),
  manufacturingSite: optionalText,
  plannedStart: optionalText,
  plannedEnd: optionalText,
  roundingRule: z.enum(ROUNDING_RULES).optional(),
  remarks: optionalText,
  status: z.enum(BATCH_PLAN_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const bomItemSchema = z.object({
  materialId: z.string().trim().min(1, "Material is required."),
  quantity: qty,
  uom: z.string().trim().min(1, "UOM is required."),
  percentage: z.coerce.number().min(0).max(100).optional(),
  sequence: z.coerce.number().int().min(1).optional(),
  materialStage: z.enum(MATERIAL_STAGES).default("raw_material"),
  processStep: optionalText,
  wastageAllowance: z.coerce.number().min(0).max(100).optional(),
  remarks: optionalText,
});

export const bomSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  version: optionalText,
  effectiveDate: z.string().trim().min(1, "Effective date is required."),
  expiryDate: optionalText,
  batchSize: qty,
  uom: z.string().trim().min(1, "UOM is required."),
  remarks: optionalText,
  processSteps: z.array(z.string().trim().min(1)).optional(),
  status: z.enum(BOM_STATUSES).optional(),
  idempotencyKey: optionalText,
  items: z.array(bomItemSchema).min(1, "Add at least one BOM line."),
});

export const manufacturingOrderSchema = z.object({
  productionPlanId: optionalText,
  scheduleId: optionalText,
  batchPlanId: optionalText,
  productId: z.string().trim().min(1, "Product is required."),
  customerId: optionalText,
  productVersionId: optionalText,
  bomId: optionalText,
  plannedQuantity: qty,
  batchSize: qty,
  uom: z.string().trim().min(1, "UOM is required."),
  plannedStartDate: z.string().trim().min(1, "Planned start is required."),
  plannedEndDate: z.string().trim().min(1, "Planned end is required."),
  workCenterId: optionalText,
  warehouseId: optionalText,
  priority: z.enum(PRODUCTION_PRIORITIES).default("normal"),
  supervisor: optionalText,
  remarks: optionalText,
  status: z.enum(MO_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const workCenterSchema = z.object({
  workCenterCode: z.string().trim().min(2, "Work center code is required."),
  workCenterName: z.string().trim().min(2, "Work center name is required."),
  departmentId: optionalText,
  plantId: z.string().trim().min(1, "Plant is required."),
  workCenterType: z.enum(WORK_CENTER_TYPES),
  capacity: z.coerce.number().min(0).optional(),
  uom: optionalText,
  supervisor: optionalText,
  description: optionalText,
  status: z.enum(["active", "inactive"]).default("active"),
});

export const equipmentSchema = z.object({
  equipmentCode: z.string().trim().min(2, "Equipment code is required."),
  equipmentName: z.string().trim().min(2, "Equipment name is required."),
  workCenterId: optionalText,
  qualificationStatus: optionalText,
  calibrationStatus: optionalText,
  status: z.enum(["active", "inactive", "under_maintenance"]).default("active"),
});

export const assignmentSchema = z.object({
  manufacturingOrderId: z.string().trim().min(1, "Manufacturing order is required."),
  equipmentId: optionalText,
  userId: optionalText,
  role: optionalText,
});

export const dispensingRequestSchema = z.object({
  manufacturingOrderId: z.string().trim().min(1, "Manufacturing order is required."),
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  requiredDate: z.string().trim().min(1, "Required date is required."),
  remarks: optionalText,
  status: z.enum(DISPENSING_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const bmrSchema = z.object({
  manufacturingOrderId: z.string().trim().min(1, "Manufacturing order is required."),
  remarks: optionalText,
  status: z.enum(BMR_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const processStepActionSchema = z.object({
  action: z.enum(["start", "complete", "skip", "fail"]),
  remarks: optionalText,
});

export const ipcSchema = z.object({
  bmrId: z.string().trim().min(1, "BMR is required."),
  processStepId: optionalText,
  parameter: z.string().trim().min(1, "Parameter is required."),
  specification: optionalText,
  target: optionalText,
  actual: optionalText,
  uom: optionalText,
  result: z.enum(IPC_RESULTS).default("pending"),
  remarks: optionalText,
});

export const yieldSchema = z.object({
  manufacturingOrderId: z.string().trim().min(1, "Manufacturing order is required."),
  bmrId: optionalText,
  theoreticalQuantity: qty,
  actualQuantity: qty,
  acceptableMin: z.coerce.number().min(0).optional(),
  acceptableMax: z.coerce.number().min(0).optional(),
  remarks: optionalText,
  idempotencyKey: optionalText,
});

export const reconciliationSchema = z.object({
  manufacturingOrderId: z.string().trim().min(1, "Manufacturing order is required."),
  bmrId: optionalText,
  materialId: z.string().trim().min(1, "Material is required."),
  issuedQuantity: z.coerce.number().min(0),
  returnedQuantity: z.coerce.number().min(0).optional(),
  consumedQuantity: z.coerce.number().min(0),
  wastageQuantity: z.coerce.number().min(0).optional(),
  expectedQuantity: z.coerce.number().min(0),
  remarks: optionalText,
  status: z.enum(RECON_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const wastageSchema = z.object({
  bmrId: z.string().trim().min(1, "BMR is required."),
  materialId: optionalText,
  productId: optionalText,
  batchNumber: optionalText,
  quantity: qty,
  uom: z.string().trim().min(1, "UOM is required."),
  reason: z.enum(WASTAGE_REASONS),
  processStep: optionalText,
  remarks: optionalText,
  idempotencyKey: optionalText,
});

export const deviationSchema = z.object({
  bmrId: optionalText,
  manufacturingOrderId: optionalText,
  batchNumber: optionalText,
  processStep: optionalText,
  description: z.string().trim().min(2, "Description is required."),
  severity: z.enum(DEVIATION_SEVERITIES),
  immediateAction: optionalText,
  remarks: optionalText,
  status: z.enum(DEVIATION_STATUSES).optional(),
});

export const processTemplateSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  name: z.string().trim().min(2, "Template name is required."),
  steps: z.array(z.string().trim().min(1)).min(1, "Add at least one process step."),
});
