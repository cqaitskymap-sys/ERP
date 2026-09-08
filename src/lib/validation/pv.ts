import { z } from "zod";
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  CAUSALITY_RESULTS,
  COMMITMENT_STATUSES,
  EVENT_OUTCOMES,
  EXPECTEDNESS_VALUES,
  FOLLOWUP_STATUSES,
  INTAKE_SOURCES,
  INTAKE_STATUSES,
  INTAKE_URGENCIES,
  PRODUCT_ROLES,
  REPORT_STATUSES,
  REPORTER_TYPES,
  SEVERITIES,
  SIGNAL_STATUSES,
} from "@/types/pv";

const optionalText = z.string().trim().optional().or(z.literal(""));

export const intakeSchema = z.object({
  receivedDate: optionalText,
  sourceType: z.enum(INTAKE_SOURCES).default("other"),
  sourceReference: optionalText,
  country: optionalText,
  marketId: optionalText,
  productId: optionalText,
  batchNumber: optionalText,
  description: z.string().trim().min(2, "Description is required."),
  urgency: z.enum(INTAKE_URGENCIES).default("medium"),
  attachments: optionalText,
  status: z.enum(INTAKE_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const patientSchema = z.object({
  patientReference: optionalText,
  age: optionalText,
  ageUnit: optionalText,
  sex: optionalText,
  country: optionalText,
  weight: optionalText,
  height: optionalText,
  relevantHistory: optionalText,
});

export const reporterSchema = z.object({
  reporterType: z.enum(REPORTER_TYPES).default("other"),
  qualification: optionalText,
  country: optionalText,
  organization: optionalText,
  contactReference: optionalText,
  preferredContactMethod: optionalText,
  consentStatus: optionalText,
  sourceReference: optionalText,
});

export const caseProductSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  productName: optionalText,
  productCode: optionalText,
  dosageForm: optionalText,
  strength: optionalText,
  manufacturer: optionalText,
  batchNumber: optionalText,
  manufacturingDate: optionalText,
  expiryDate: optionalText,
  dose: optionalText,
  route: optionalText,
  therapyStartDate: optionalText,
  therapyEndDate: optionalText,
  indication: optionalText,
  actionTaken: optionalText,
  productRole: z.enum(PRODUCT_ROLES).default("suspect"),
});

export const caseEventSchema = z.object({
  eventTerm: z.string().trim().min(1, "Event term is required."),
  description: optionalText,
  onsetDate: optionalText,
  endDate: optionalText,
  outcome: z.enum(EVENT_OUTCOMES).default("unknown"),
  seriousness: optionalText,
  severity: z.enum(SEVERITIES).default("unknown"),
  actionTaken: optionalText,
  medicalHistoryReference: optionalText,
  notes: optionalText,
});

export const caseSchema = z.object({
  intakeId: optionalText,
  receivedDate: optionalText,
  initialReceiptDate: optionalText,
  sourceType: z.enum(INTAKE_SOURCES).optional(),
  country: optionalText,
  marketId: optionalText,
  customerId: optionalText,
  productId: optionalText,
  batchNumber: optionalText,
  description: optionalText,
  priority: z.enum(CASE_PRIORITIES).default("medium"),
  assignedTo: optionalText,
  medicalReviewer: optionalText,
  regulatoryReviewer: optionalText,
  dueDate: optionalText,
  reportingRuleId: optionalText,
  capaId: optionalText,
  changeControlId: optionalText,
  status: z.enum(CASE_STATUSES).optional(),
  patient: patientSchema.optional(),
  reporter: reporterSchema.optional(),
  products: z.array(caseProductSchema).optional(),
  events: z.array(caseEventSchema).optional(),
  idempotencyKey: optionalText,
});

export const seriousnessSchema = z.object({
  criteria: z.array(z.object({
    criterion: z.string(),
    selected: z.boolean(),
    rationale: optionalText,
  })).min(1, "At least one criterion is required."),
  overallSerious: z.boolean().optional(),
  rationale: z.string().trim().min(2, "Reviewer rationale is required."),
});

export const expectednessSchema = z.object({
  expectedness: z.enum(EXPECTEDNESS_VALUES),
  referenceDocument: optionalText,
  referenceVersion: optionalText,
  assessment: optionalText,
  rationale: z.string().trim().min(2, "Rationale is required."),
});

export const causalitySchema = z.object({
  assessmentMethod: optionalText,
  result: z.enum(CAUSALITY_RESULTS),
  rationale: z.string().trim().min(2, "Rationale is required."),
});

export const medicalReviewSchema = z.object({
  comment: z.string().trim().min(2, "Review comment is required."),
  requestFollowUp: z.boolean().optional(),
});

export const followUpSchema = z.object({
  caseId: z.string().trim().min(1, "Case is required."),
  requestedFrom: optionalText,
  requestReason: z.string().trim().min(2, "Reason is required."),
  dueDate: optionalText,
  assignedTo: optionalText,
  questions: z.array(z.string()).optional(),
  response: optionalText,
  status: z.enum(FOLLOWUP_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const reportingRuleSchema = z.object({
  marketId: optionalText,
  authorityId: optionalText,
  caseType: optionalText,
  seriousnessCriteria: optionalText,
  reportingRequirement: optionalText,
  reportingWindow: z.coerce.number().min(1).max(365).default(15),
  processingWindow: z.coerce.number().min(1).max(365).default(30),
  effectiveDate: optionalText,
  expiryDate: optionalText,
  sourceReference: optionalText,
  timezone: optionalText,
  status: optionalText,
});

export const regulatoryReportSchema = z.object({
  caseId: z.string().trim().min(1, "Case is required."),
  marketId: optionalText,
  authorityId: optionalText,
  reportType: optionalText,
  reportingDueDate: optionalText,
  reportingRuleId: optionalText,
  remarks: optionalText,
  status: z.enum(REPORT_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const signalSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  eventTerm: z.string().trim().min(1, "Event term is required."),
  marketId: optionalText,
  detectedDate: optionalText,
  detectionSource: optionalText,
  description: z.string().trim().min(2, "Description is required."),
  evidence: optionalText,
  ownerId: optionalText,
  capaId: optionalText,
  changeControlId: optionalText,
  status: z.enum(SIGNAL_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const signalAssessmentSchema = z.object({
  assessment: z.string().trim().min(2, "Assessment is required."),
  rationale: z.string().trim().min(2, "Rationale is required."),
  action: optionalText,
  conclusion: optionalText,
});

export const commitmentSchema = z.object({
  source: optionalText,
  sourceId: optionalText,
  description: z.string().trim().min(2, "Description is required."),
  ownerId: optionalText,
  dueDate: optionalText,
  priority: z.enum(CASE_PRIORITIES).default("medium"),
  evidence: optionalText,
  status: z.enum(COMMITMENT_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const retentionPolicySchema = z.object({
  recordType: z.string().trim().min(1, "Record type is required."),
  retentionPeriod: z.string().trim().min(1, "Retention period is required."),
  effectiveDate: optionalText,
  jurisdiction: optionalText,
  policyReference: optionalText,
  status: optionalText,
});
