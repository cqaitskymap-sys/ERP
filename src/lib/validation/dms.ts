import { z } from "zod";
import {
  CLASSIFICATIONS,
  DCR_TYPES,
  DOCUMENT_TYPES,
  PERIODIC_DECISIONS,
} from "@/types/dms";

const optionalText = z.string().trim().max(500).optional().or(z.literal(""));

export const documentCreateSchema = z.object({
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  documentType: z.enum(DOCUMENT_TYPES),
  category: optionalText,
  departmentId: optionalText,
  siteId: optionalText,
  ownerId: optionalText,
  reviewerId: optionalText,
  approverId: optionalText,
  confidentiality: z.enum(CLASSIFICATIONS).default("internal"),
  relatedProducts: optionalText,
  relatedProcesses: optionalText,
  relatedEquipment: optionalText,
  relatedMaterials: optionalText,
  relatedDepartments: optionalText,
  changeControlId: optionalText,
  deviationId: optionalText,
  capaId: optionalText,
  validationRef: optionalText,
  batchRef: optionalText,
  trainingCourseId: optionalText,
  reviewIntervalDays: z.coerce.number().int().min(30).max(3650).optional(),
  changeSummary: z.string().trim().max(2000).optional().or(z.literal("")),
  textExtract: z.string().max(20000).optional().or(z.literal("")),
  idempotencyKey: optionalText,
});

export const documentUpdateSchema = documentCreateSchema.partial().extend({
  idempotencyKey: optionalText,
});

export const signatureSchema = z.object({
  reason: z.string().trim().min(3).max(2000),
  signatureEmail: z.string().trim().email(),
  meaning: optionalText,
});

export const filePrepareSchema = z.object({
  documentId: z.string().trim().min(1),
  versionId: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(160),
  sizeBytes: z.coerce.number().int().positive(),
  checksumSha256: z.string().trim().min(64).max(64),
});

export const fileConfirmSchema = filePrepareSchema.extend({
  storagePath: z.string().trim().min(1).max(400),
});

export const changeRequestSchema = z.object({
  requestType: z.enum(DCR_TYPES),
  title: z.string().trim().min(3).max(240),
  reason: z.string().trim().min(3).max(4000),
  expectedImpact: z.string().trim().min(3).max(4000),
  documentId: optionalText,
  gmpImpact: z.boolean().default(false),
  impactAssessment: optionalText,
  changeControlId: optionalText,
  affectedDepartments: optionalText,
  affectedProducts: optionalText,
  affectedProcesses: optionalText,
  affectedEquipment: optionalText,
  relatedDocuments: optionalText,
  evidenceNote: optionalText,
  idempotencyKey: optionalText,
});

export const periodicReviewSchema = z.object({
  decision: z.enum(PERIODIC_DECISIONS),
  reason: z.string().trim().min(3).max(4000),
  evidenceNote: optionalText,
  signatureEmail: z.string().trim().email(),
});

export const externalDocumentSchema = z.object({
  title: z.string().trim().min(3).max(240),
  documentType: z.enum(["vendor", "certificate", "regulatory_external", "other"]),
  issuer: z.string().trim().min(1).max(200),
  referenceNumber: optionalText,
  departmentId: optionalText,
  siteId: optionalText,
  ownerId: optionalText,
  expiryDate: z.string().trim().min(8).max(40),
  reminderDays: z.coerce.number().int().min(1).max(365).optional(),
  confidentiality: z.enum(CLASSIFICATIONS).default("internal"),
  notes: optionalText,
  idempotencyKey: optionalText,
});

export const templateSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  label: z.string().trim().min(2).max(120),
  prefix: z.string().trim().min(2).max(12).regex(/^[A-Z0-9]+$/),
  category: optionalText,
  reviewIntervalDays: z.coerce.number().int().min(30).max(3650),
  defaultConfidentiality: z.enum(CLASSIFICATIONS).default("internal"),
  trainingRequired: z.boolean().default(false),
  gmpDefault: z.boolean().default(false),
  requiredApprovals: z.coerce.number().int().min(1).max(5).default(1),
  requireReview: z.boolean().default(true),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const settingsSchema = z.object({
  segregationOfDuties: z.boolean(),
  requireSignatureEmailConfirmation: z.boolean(),
  reviewSoonDays: z.coerce.number().int().min(1).max(180),
  expirySoonDays: z.coerce.number().int().min(1).max(180),
  defaultReviewIntervalDays: z.coerce.number().int().min(30).max(3650),
  retentionYears: z.coerce.number().int().min(1).max(40),
  requireFileBeforeRelease: z.boolean(),
  requireReviewBeforeApproval: z.boolean(),
  requiredApprovals: z.coerce.number().int().min(1).max(5),
});

export const reviseSchema = z.object({
  revisionType: z.enum(["minor", "major"]).default("minor"),
  reason: z.string().trim().min(3).max(2000),
  signatureEmail: z.string().trim().email(),
});

export const assignTrainingSchema = z.object({
  employeeIds: z.array(z.string().trim().min(1)).min(1).max(50),
  dueDate: optionalText,
  reason: z.string().trim().min(3).max(1000),
});
