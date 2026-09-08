import { z } from "zod";
import {
  CAPA_SOURCES,
  CHANGE_TYPES,
  CHECKLIST_STATUSES,
  DEVIATION_SOURCES,
  HOLD_REASONS,
  QA_DECISIONS,
  QA_DOCUMENT_STATUSES,
  QA_DOCUMENT_TYPES,
  QA_PRIORITIES,
  QA_SEVERITIES,
  REJECTION_CATEGORIES,
} from "@/types/qa";

const optionalText = z.string().trim().optional().or(z.literal(""));

export const batchReviewSchema = z.object({
  manufacturingOrderId: z.string().trim().min(1, "Manufacturing order is required."),
  batchNumber: optionalText,
  productId: optionalText,
  customerId: optionalText,
  plantId: optionalText,
  priority: z.enum(QA_PRIORITIES).default("normal"),
  dueDate: optionalText,
  qcCompletedAt: optionalText,
  remarks: optionalText,
  checklist: z
    .array(
      z.object({
        item: z.string().trim().min(1),
        mandatory: z.boolean().optional(),
      })
    )
    .optional(),
  idempotencyKey: optionalText,
});

export const checklistItemUpdateSchema = z.object({
  itemId: z.string().trim().min(1, "Checklist item is required."),
  status: z.enum(CHECKLIST_STATUSES),
  comment: optionalText,
  evidenceReference: optionalText,
});

export const dispositionSchema = z.object({
  decision: z.enum(QA_DECISIONS),
  reason: z.string().trim().min(2, "Reason is required."),
  comments: optionalText,
  effectiveDate: optionalText,
  holdReason: z.enum(HOLD_REASONS).optional(),
  rejectionCategory: z.enum(REJECTION_CATEGORIES).optional(),
  idempotencyKey: optionalText,
});

export const deviationSchema = z.object({
  source: z.enum(DEVIATION_SOURCES).default("other"),
  batchNumber: optionalText,
  productId: optionalText,
  manufacturingOrderId: optionalText,
  processStep: optionalText,
  description: z.string().trim().min(2, "Description is required."),
  category: optionalText,
  severity: z.enum(QA_SEVERITIES).default("major"),
  immediateAction: optionalText,
  investigation: optionalText,
  rootCause: optionalText,
  impactAssessment: optionalText,
  capaRequired: z.boolean().optional(),
  remarks: optionalText,
  supplierId: optionalText,
  materialId: optionalText,
  sourceId: optionalText,
});

export const capaSchema = z.object({
  sourceType: z.enum(CAPA_SOURCES).default("other"),
  sourceId: optionalText,
  description: z.string().trim().min(2, "Description is required."),
  problemStatement: optionalText,
  rootCause: optionalText,
  correction: optionalText,
  correctiveAction: optionalText,
  preventiveAction: optionalText,
  ownerId: optionalText,
  dueDate: optionalText,
  priority: z.enum(QA_PRIORITIES).default("normal"),
  remarks: optionalText,
});

export const changeControlSchema = z.object({
  title: z.string().trim().min(2, "Title is required."),
  description: z.string().trim().min(2, "Description is required."),
  reason: z.string().trim().min(2, "Reason is required."),
  changeType: z.enum(CHANGE_TYPES).default("minor"),
  impactAssessment: optionalText,
  riskAssessment: optionalText,
  affectedModules: optionalText,
  affectedProducts: optionalText,
  affectedDocuments: optionalText,
  implementationPlan: optionalText,
  validationRequired: z.boolean().optional(),
  trainingRequired: z.boolean().optional(),
  ownerId: optionalText,
  dueDate: optionalText,
  sourceType: optionalText,
  sourceId: optionalText,
});

export const documentReviewSchema = z.object({
  documentType: z.enum(QA_DOCUMENT_TYPES),
  title: z.string().trim().min(2, "Title is required."),
  documentNumber: optionalText,
  version: optionalText,
  ownerId: optionalText,
  departmentId: optionalText,
  effectiveDate: optionalText,
  reviewDate: optionalText,
  expiryDate: optionalText,
  sourceRecordId: optionalText,
  remarks: optionalText,
  status: z.enum(QA_DOCUMENT_STATUSES).optional(),
});

export const releaseCertificateSchema = z.object({
  reviewId: z.string().trim().min(1, "QA review is required."),
  idempotencyKey: optionalText,
});
