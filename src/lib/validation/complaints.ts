import { z } from "zod";
import {
  COMMUNICATION_STATUSES,
  COMMUNICATION_TYPES,
  COMPLAINT_SEVERITIES,
  COMPLAINT_SOURCES,
  COMPLAINT_STATUSES,
  COMPLAINT_URGENCIES,
  INVESTIGATION_STATUSES,
  NOTIFICATION_STATUSES,
  QA_DECISIONS,
  RECALL_CLASSES,
  RECALL_STATUSES,
  SAMPLE_STATUSES,
  TASK_STATUSES,
  WITHDRAWAL_STATUSES,
} from "@/types/complaints";

const optionalText = z.string().trim().optional().or(z.literal(""));

export const complaintSchema = z.object({
  receivedDate: optionalText,
  sourceType: z.enum(COMPLAINT_SOURCES).default("customer"),
  customerId: optionalText,
  contactReference: optionalText,
  country: optionalText,
  marketId: optionalText,
  productId: z.string().trim().min(1, "Product is required."),
  batchNumber: optionalText,
  complaintDescription: z.string().trim().min(2, "Description is required."),
  urgency: z.enum(COMPLAINT_URGENCIES).default("medium"),
  initialAssessment: optionalText,
  category: optionalText,
  severity: z.enum(COMPLAINT_SEVERITIES).optional(),
  assignedTo: optionalText,
  capaId: optionalText,
  changeControlId: optionalText,
  pvCaseId: optionalText,
  attachments: optionalText,
  status: z.enum(COMPLAINT_STATUSES).optional(),
  slaRuleId: optionalText,
  idempotencyKey: optionalText,
});

export const categorySchema = z.object({
  categoryCode: z.string().trim().min(1, "Code is required."),
  categoryName: z.string().trim().min(1, "Name is required."),
  status: optionalText,
});

export const slaRuleSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  acknowledgementDays: z.coerce.number().min(1).max(90).default(2),
  triageDays: z.coerce.number().min(1).max(90).default(5),
  investigationDays: z.coerce.number().min(1).max(365).default(30),
  qaReviewDays: z.coerce.number().min(1).max(90).default(7),
  customerResponseDays: z.coerce.number().min(1).max(90).default(10),
  closureDays: z.coerce.number().min(1).max(365).default(45),
  timezone: optionalText,
  status: optionalText,
});

export const investigationSchema = z.object({
  complaintId: z.string().trim().min(1, "Complaint is required."),
  investigationLead: optionalText,
  department: optionalText,
  objective: optionalText,
  scope: optionalText,
  dueDate: optionalText,
  conclusion: optionalText,
  status: z.enum(INVESTIGATION_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const investigatorSchema = z.object({
  userId: z.string().trim().min(1, "User is required."),
  department: z.string().trim().min(1, "Department is required."),
  role: optionalText,
  responsibility: optionalText,
  dueDate: optionalText,
});

export const investigationTaskSchema = z.object({
  investigationId: z.string().trim().min(1, "Investigation is required."),
  assignedTo: optionalText,
  department: optionalText,
  taskType: optionalText,
  description: z.string().trim().min(2, "Description is required."),
  dueDate: optionalText,
  priority: optionalText,
  evidence: optionalText,
  response: optionalText,
  status: z.enum(TASK_STATUSES).optional(),
});

export const sampleSchema = z.object({
  complaintId: z.string().trim().min(1, "Complaint is required."),
  receivedDate: optionalText,
  receivedFrom: optionalText,
  quantity: optionalText,
  condition: optionalText,
  storageCondition: optionalText,
  sampleLocation: optionalText,
  testRequired: optionalText,
  qcTestRequestId: optionalText,
  status: z.enum(SAMPLE_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const sampleTransferSchema = z.object({
  from: z.string().trim().min(1, "From is required."),
  to: z.string().trim().min(1, "To is required."),
  location: optionalText,
  reason: z.string().trim().min(2, "Reason is required."),
});

export const rootCauseSchema = z.object({
  investigationId: z.string().trim().min(1, "Investigation is required."),
  method: optionalText,
  category: optionalText,
  description: z.string().trim().min(2, "Description is required."),
  evidence: optionalText,
  conclusion: z.string().trim().min(2, "Qualified conclusion is required."),
  confidence: optionalText,
});

export const riskAssessmentSchema = z.object({
  complaintId: z.string().trim().min(1, "Complaint is required."),
  method: optionalText,
  severity: z.coerce.number().min(1).max(10),
  occurrence: z.coerce.number().min(1).max(10),
  detectability: z.coerce.number().min(1).max(10),
  formula: optionalText,
  rationale: z.string().trim().min(2, "Rationale is required."),
});

export const qaDecisionSchema = z.object({
  decision: z.enum(QA_DECISIONS),
  rationale: z.string().trim().min(2, "Rationale is required."),
});

export const communicationSchema = z.object({
  complaintId: z.string().trim().min(1, "Complaint is required."),
  customerId: optionalText,
  communicationType: z.enum(COMMUNICATION_TYPES).default("acknowledgement"),
  subject: z.string().trim().min(1, "Subject is required."),
  summary: optionalText,
  response: optionalText,
  attachment: optionalText,
  status: z.enum(COMMUNICATION_STATUSES).optional(),
});

export const recallSchema = z.object({
  complaintId: optionalText,
  productId: z.string().trim().min(1, "Product is required."),
  reason: z.string().trim().min(2, "Reason is required."),
  riskAssessment: optionalText,
  recallClass: z.enum(RECALL_CLASSES).default("other"),
  markets: optionalText,
  status: z.enum(RECALL_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const recallBatchSchema = z.object({
  batchNumber: z.string().trim().min(1, "Batch is required."),
  affectedQuantity: optionalText,
  releasedQuantity: optionalText,
  distributedQuantity: optionalText,
});

export const recallCustomerSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required."),
  batchNumber: optionalText,
  quantity: optionalText,
  shipmentDate: optionalText,
  marketId: optionalText,
});

export const recallReturnSchema = z.object({
  customerId: optionalText,
  batchNumber: optionalText,
  quantityShipped: optionalText,
  quantityReturned: optionalText,
  returnDate: optionalText,
  condition: optionalText,
  location: optionalText,
  disposition: optionalText,
});

export const withdrawalSchema = z.object({
  complaintId: optionalText,
  productId: z.string().trim().min(1, "Product is required."),
  reason: z.string().trim().min(2, "Reason is required."),
  classification: optionalText,
  markets: optionalText,
  status: z.enum(WITHDRAWAL_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const regulatoryNotificationSchema = z.object({
  complaintId: optionalText,
  recallId: optionalText,
  authorityId: optionalText,
  marketId: optionalText,
  subject: z.string().trim().min(1, "Subject is required."),
  summary: optionalText,
  status: z.enum(NOTIFICATION_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const linkSchema = z.object({
  capaId: optionalText,
  changeControlId: optionalText,
  pvCaseId: optionalText,
});
