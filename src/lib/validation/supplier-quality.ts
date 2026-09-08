import { z } from "zod";
import {
  AGREEMENT_TYPES,
  AUDIT_STATUSES,
  AUDIT_TYPES,
  CHANGE_STATUSES,
  CHANGE_TYPES,
  DOCUMENT_STATUSES,
  FINDING_SEVERITIES,
  MATERIAL_QUAL_STATUSES,
  QUALIFICATION_STATUSES,
  QUALIFICATION_TYPES,
  QUESTIONNAIRE_STATUSES,
  REQUAL_STATUSES,
  SQ_PROFILE_STATUSES,
  SQ_RISK_LEVELS,
  SUSPENSION_REASONS,
  SUSPENSION_STATUSES,
} from "@/types/supplier-quality";

const optionalText = z.string().trim().optional().or(z.literal(""));

export const profileSchema = z.object({
  supplierId: z.string().trim().min(1, "Vendor / supplier is required."),
  remarks: optionalText,
  status: z.enum(SQ_PROFILE_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const riskSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  materialCriticality: z.coerce.number().min(0).max(10),
  productImpact: z.coerce.number().min(0).max(10),
  regulatoryImpact: z.coerce.number().min(0).max(10),
  supplierHistory: z.coerce.number().min(0).max(10),
  geographicRisk: z.coerce.number().min(0).max(10),
  manufacturingComplexity: z.coerce.number().min(0).max(10),
  qualityPerformance: z.coerce.number().min(0).max(10),
  auditHistory: z.coerce.number().min(0).max(10),
  certificateStatus: z.coerce.number().min(0).max(10),
  changeHistory: z.coerce.number().min(0).max(10),
  method: optionalText,
  rationale: z.string().trim().min(2, "Rationale is required."),
});

export const qualificationSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  qualificationType: z.enum(QUALIFICATION_TYPES).default("initial"),
  riskLevel: z.enum(SQ_RISK_LEVELS).optional(),
  owner: optionalText,
  targetDate: optionalText,
  remarks: optionalText,
  status: z.enum(QUALIFICATION_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const documentSchema = z.object({
  qualificationId: z.string().trim().min(1, "Qualification is required."),
  documentType: z.string().trim().min(1, "Document type is required."),
  issueDate: optionalText,
  expiryDate: optionalText,
  version: optionalText,
  owner: optionalText,
  status: z.enum(DOCUMENT_STATUSES).optional(),
});

export const questionnaireSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  qualificationId: optionalText,
  title: z.string().trim().min(1, "Title is required."),
  sections: optionalText,
  status: z.enum(QUESTIONNAIRE_STATUSES).optional(),
});

export const evaluationSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  quality: z.coerce.number().min(0).max(100),
  delivery: z.coerce.number().min(0).max(100),
  documentation: z.coerce.number().min(0).max(100),
  compliance: z.coerce.number().min(0).max(100),
  service: z.coerce.number().min(0).max(100),
  remarks: optionalText,
  method: optionalText,
});

export const materialQualSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  materialId: z.string().trim().min(1, "Material is required."),
  qualificationStatus: z.enum(MATERIAL_QUAL_STATUSES).default("pending"),
  expiryDate: optionalText,
  restrictions: optionalText,
  remarks: optionalText,
});

export const auditSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  auditType: z.enum(AUDIT_TYPES).default("periodic"),
  plannedDate: optionalText,
  leadAuditor: optionalText,
  auditTeam: optionalText,
  scope: optionalText,
  objective: optionalText,
  status: z.enum(AUDIT_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const findingSchema = z.object({
  auditId: z.string().trim().min(1, "Audit is required."),
  category: optionalText,
  description: z.string().trim().min(2, "Description is required."),
  evidence: optionalText,
  severity: z.enum(FINDING_SEVERITIES).default("observation"),
  requirementReference: optionalText,
  dueDate: optionalText,
});

export const certificateSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  certificateType: z.string().trim().min(1, "Type is required."),
  certificateNumber: optionalText,
  issuingAuthority: optionalText,
  issueDate: optionalText,
  expiryDate: optionalText,
});

export const agreementSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  agreementType: z.enum(AGREEMENT_TYPES).default("quality"),
  effectiveDate: optionalText,
  expiryDate: optionalText,
  version: optionalText,
  owner: optionalText,
  documentReference: optionalText,
  idempotencyKey: optionalText,
});

export const changeSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  changeType: z.enum(CHANGE_TYPES).default("other"),
  description: z.string().trim().min(2, "Description is required."),
  impactAssessment: optionalText,
  materialImpact: optionalText,
  regulatoryImpact: optionalText,
  status: z.enum(CHANGE_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const suspensionSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  reason: z.enum(SUSPENSION_REASONS).default("other"),
  remarks: z.string().trim().min(2, "Remarks are required."),
  status: z.enum(SUSPENSION_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const requalificationSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  qualificationId: optionalText,
  plannedDate: optionalText,
  dueDate: optionalText,
  riskLevel: z.enum(SQ_RISK_LEVELS).optional(),
  auditRequired: z.boolean().optional(),
  status: z.enum(REQUAL_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const communicationSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required."),
  type: z.string().trim().min(1, "Type is required."),
  direction: optionalText,
  subject: z.string().trim().min(1, "Subject is required."),
  summary: optionalText,
});

export const linkSchema = z.object({
  capaId: optionalText,
  changeControlId: optionalText,
  deviationId: optionalText,
});
