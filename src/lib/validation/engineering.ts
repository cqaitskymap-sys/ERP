import { z } from "zod";
import {
  BREAKDOWN_SEVERITIES,
  BREAKDOWN_STATUSES,
  CALIBRATION_STATUSES,
  CRITICALITY_LEVELS,
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_STATUSES,
  INSTRUMENT_STATUSES,
  MONITORING_PARAMETERS,
  QUALIFICATION_STATUSES,
  QUALIFICATION_TYPES,
  UTILITY_SYSTEM_TYPES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
} from "@/types/engineering";

const optionalText = z.string().trim().optional().or(z.literal(""));
const score = z.coerce.number().int().min(1).max(5);
const moneyField = z.coerce.number().finite().min(0).default(0);

export const engineeringSettingsSchema = z.object({
  pmDueSoonDays: z.coerce.number().int().min(0).default(7),
  calibrationDueSoonDays: z.coerce.number().int().min(0).default(14),
  requireQaReviewForCriticalBreakdowns: z.boolean().default(true),
  requireQaReviewForCalibrationFailure: z.boolean().default(true),
  restrictEquipmentOnCalibrationFailure: z.boolean().default(true),
  currency: z.string().trim().min(1).default("INR"),
  allowEstimatedCostsInTotals: z.boolean().default(false),
});

export const equipmentSchema = z.object({
  name: z.string().trim().min(1),
  category: z.enum(EQUIPMENT_CATEGORIES),
  equipmentType: optionalText,
  manufacturer: optionalText,
  model: optionalText,
  serialNumber: optionalText,
  assetNumber: optionalText,
  facilityId: optionalText,
  building: optionalText,
  floor: optionalText,
  departmentId: optionalText,
  installationLocation: optionalText,
  installationDate: optionalText,
  commissioningDate: optionalText,
  equipmentOwnerId: optionalText,
  responsibleEngineerId: optionalText,
  criticality: z.enum(CRITICALITY_LEVELS).default("minor"),
  intendedUse: optionalText,
  operatingRange: optionalText,
  specifications: optionalText,
  utilityRequirements: optionalText,
  requiresCalibration: z.boolean().default(false),
  requiresQualification: z.boolean().default(false),
  supplierId: optionalText,
  serviceProviderId: optionalText,
  warrantyExpiry: optionalText,
  productionEquipmentId: optionalText,
  qcInstrumentId: optionalText,
  fixedAssetId: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const riskAssessmentSchema = z.object({
  equipmentId: z.string().trim().min(1),
  productQualityImpact: score,
  patientSafetyImpact: score,
  dataIntegrityImpact: score,
  processImpact: score,
  businessContinuityImpact: score,
  failureProbability: score,
  failureSeverity: score,
  detectability: score.optional(),
  reviewDueDate: optionalText,
  notes: optionalText,
});

export const maintenancePlanSchema = z.object({
  equipmentId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  maintenanceType: z.string().trim().min(1).default("preventive"),
  taskDescription: z.string().trim().min(1),
  checklistId: optionalText,
  departmentId: optionalText,
  assignedTechnicianId: optionalText,
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "half_yearly", "yearly", "custom"]),
  customIntervalDays: z.coerce.number().int().min(0).optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(0).default(60),
  safetyPrecautions: optionalText,
  workInstructions: optionalText,
  requiredSparePartIds: z.array(z.string()).default([]),
  approvalRequired: z.boolean().default(false),
  startDate: z.string().trim().min(1),
  active: z.boolean().default(true),
  idempotencyKey: optionalText,
});

export const workOrderSchema = z.object({
  equipmentId: z.string().trim().min(1),
  workOrderType: z.enum(WORK_ORDER_TYPES),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  failureDescription: z.string().trim().min(1),
  departmentId: optionalText,
  assignedTechnicianId: optionalText,
  plannedStart: optionalText,
  plannedEnd: optionalText,
  workInstructions: optionalText,
  safetyPrecautions: optionalText,
  serviceProviderId: optionalText,
  maintenancePlanId: optionalText,
  breakdownId: optionalText,
  checklistId: optionalText,
  requireQaReview: z.boolean().default(false),
  sparePartRequests: z
    .array(
      z.object({
        materialId: z.string().trim().min(1),
        quantity: z.coerce.number().finite().min(0.0001),
        uom: optionalText,
      })
    )
    .default([]),
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const breakdownSchema = z.object({
  equipmentId: z.string().trim().min(1),
  failureAt: z.string().trim().min(1),
  symptoms: z.string().trim().min(1),
  severity: z.enum(BREAKDOWN_SEVERITIES).default("medium"),
  errorCodes: optionalText,
  productionImpact: z.boolean().default(false),
  qualityImpact: z.boolean().default(false),
  safetyImpact: z.boolean().default(false),
  immediateContainment: optionalText,
  downtimeStart: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const instrumentSchema = z.object({
  name: z.string().trim().min(1),
  equipmentId: optionalText,
  manufacturer: optionalText,
  model: optionalText,
  serialNumber: optionalText,
  measurementType: z.string().trim().min(1),
  measurementRange: optionalText,
  resolution: optionalText,
  accuracyRequirements: optionalText,
  toleranceLower: moneyField,
  toleranceUpper: moneyField,
  calibrationMethod: optionalText,
  calibrationFrequency: z.enum(["monthly", "quarterly", "half_yearly", "yearly", "custom"]).default("yearly"),
  customIntervalDays: z.coerce.number().int().min(0).optional(),
  calibrationProviderId: optionalText,
  referenceStandardId: optionalText,
  qcInstrumentId: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const calibrationRecordSchema = z.object({
  instrumentId: z.string().trim().min(1),
  scheduledDate: z.string().trim().min(1),
  calibrationMethod: optionalText,
  calibrationProviderId: optionalText,
  referenceStandardId: optionalText,
  referenceStandardCalibrationStatus: optionalText,
  environmentalConditions: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const calibrationResultsSchema = z.object({
  readings: z
    .array(
      z.object({
        point: z.string().trim().min(1),
        asFound: z.coerce.number().finite().optional(),
        asLeft: z.coerce.number().finite().optional(),
        lowerLimit: z.coerce.number().finite(),
        upperLimit: z.coerce.number().finite(),
      })
    )
    .min(1),
  certificateReference: optionalText,
  technicianId: optionalText,
  calibrationDate: z.string().trim().min(1),
  comment: optionalText,
});

export const qualificationSchema = z.object({
  equipmentId: z.string().trim().min(1),
  qualificationType: z.enum(QUALIFICATION_TYPES),
  protocolDocumentId: optionalText,
  reportDocumentId: optionalText,
  effectiveFrom: optionalText,
  reviewDueDate: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const checklistSchema = z.object({
  name: z.string().trim().min(1),
  equipmentCategory: z.enum(EQUIPMENT_CATEGORIES).optional(),
  version: z.string().trim().min(1).default("1.0"),
  effectiveFrom: z.string().trim().min(1),
  documentReference: optionalText,
  steps: z
    .array(
      z.object({
        sequence: z.coerce.number().int().min(1),
        instruction: z.string().trim().min(1),
        requiresReading: z.boolean().default(false),
        passFail: z.boolean().default(true),
      })
    )
    .min(1),
});

export const utilitySystemSchema = z.object({
  name: z.string().trim().min(1),
  systemType: z.enum(UTILITY_SYSTEM_TYPES),
  facilityId: optionalText,
  location: optionalText,
  operatingParameters: optionalText,
  responsibleDepartmentId: optionalText,
  lowerLimit: z.coerce.number().finite().optional(),
  upperLimit: z.coerce.number().finite().optional(),
  limitUnit: optionalText,
  maintenancePlanId: optionalText,
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const monitoringRecordSchema = z.object({
  utilitySystemId: z.string().trim().min(1),
  parameter: z.enum(MONITORING_PARAMETERS),
  value: z.coerce.number().finite(),
  unit: z.string().trim().min(1),
  measuredAt: z.string().trim().min(1),
  sourceType: z.enum(["manual", "csv_import", "api", "iot"]).default("manual"),
  instrumentId: optionalText,
  lowerLimit: z.coerce.number().finite().optional(),
  upperLimit: z.coerce.number().finite().optional(),
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const spareLinkSchema = z.object({
  materialId: z.string().trim().min(1),
  equipmentId: optionalText,
  partNumber: optionalText,
  criticalSpare: z.boolean().default(false),
  reorderThreshold: z.coerce.number().finite().min(0).default(0),
  notes: optionalText,
});

export {
  EQUIPMENT_STATUSES,
  WORK_ORDER_STATUSES,
  BREAKDOWN_STATUSES,
  CALIBRATION_STATUSES,
  INSTRUMENT_STATUSES,
  QUALIFICATION_STATUSES,
};
