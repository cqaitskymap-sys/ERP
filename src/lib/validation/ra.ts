import { z } from "zod";
import {
  ARTWORK_STATUSES,
  CHANGE_STATUSES,
  COMMITMENT_SOURCES,
  COMMITMENT_STATUSES,
  COMMUNICATION_DIRECTIONS,
  COMMUNICATION_TYPES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  LICENSE_STATUSES,
  PROFILE_STATUSES,
  QUERY_STATUSES,
  REGISTRATION_STATUSES,
  REGISTRATION_TYPES,
  RENEWAL_STATUSES,
} from "@/types/ra";

const optionalText = z.string().trim().optional().or(z.literal(""));

export const profileSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  productCode: optionalText,
  productName: optionalText,
  dosageForm: optionalText,
  strength: optionalText,
  compositionReference: optionalText,
  regulatoryCategory: optionalText,
  manufacturingSite: optionalText,
  plantId: optionalText,
  regulatoryOwner: optionalText,
  status: z.enum(PROFILE_STATUSES).optional(),
  remarks: optionalText,
  idempotencyKey: optionalText,
});

export const marketSchema = z.object({
  marketCode: z.string().trim().min(1, "Market code is required."),
  marketName: z.string().trim().min(1, "Market name is required."),
  country: optionalText,
  region: optionalText,
  regulatoryAuthorityId: optionalText,
  currency: optionalText,
  timezone: optionalText,
  status: optionalText,
  remarks: optionalText,
});

export const authoritySchema = z.object({
  authorityName: z.string().trim().min(1, "Authority name is required."),
  country: optionalText,
  region: optionalText,
  websiteReference: optionalText,
  contactDetails: optionalText,
  submissionMethod: optionalText,
  notes: optionalText,
  status: optionalText,
});

export const registrationSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  marketId: z.string().trim().min(1, "Market is required."),
  authorityId: optionalText,
  applicant: optionalText,
  manufacturer: optionalText,
  marketingAuthorizationHolder: optionalText,
  registrationDate: optionalText,
  approvalDate: optionalText,
  expiryDate: optionalText,
  registrationType: z.enum(REGISTRATION_TYPES).default("new_registration"),
  regulatoryOwner: optionalText,
  remarks: optionalText,
  status: z.enum(REGISTRATION_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const submissionSchema = z.object({
  registrationId: optionalText,
  productId: z.string().trim().min(1, "Product is required."),
  marketId: optionalText,
  authorityId: optionalText,
  submissionType: optionalText,
  submissionDate: optionalText,
  expectedResponseDate: optionalText,
  remarks: optionalText,
  idempotencyKey: optionalText,
});

export const dossierSchema = z.object({
  registrationId: optionalText,
  productId: z.string().trim().min(1, "Product is required."),
  marketId: optionalText,
  title: z.string().trim().min(1, "Title is required."),
  remarks: optionalText,
  sections: z.array(z.object({ section: z.string(), title: z.string().optional() })).optional(),
  idempotencyKey: optionalText,
});

export const documentSchema = z.object({
  documentTitle: z.string().trim().min(1, "Title is required."),
  documentType: z.enum(DOCUMENT_TYPES).default("other"),
  productId: optionalText,
  marketId: optionalText,
  registrationId: optionalText,
  submissionId: optionalText,
  version: optionalText,
  effectiveDate: optionalText,
  expiryDate: optionalText,
  ownerId: optionalText,
  remarks: optionalText,
  status: z.enum(DOCUMENT_STATUSES).optional(),
});

export const licenseSchema = z.object({
  licenseType: z.string().trim().min(1, "License type is required."),
  issuingAuthority: optionalText,
  authorityId: optionalText,
  plantId: optionalText,
  site: optionalText,
  issueDate: optionalText,
  expiryDate: optionalText,
  responsiblePerson: optionalText,
  documentReference: optionalText,
  remarks: optionalText,
  status: z.enum(LICENSE_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const renewalSchema = z.object({
  registrationId: z.string().trim().min(1, "Registration is required."),
  currentExpiryDate: optionalText,
  plannedSubmissionDate: optionalText,
  ownerId: optionalText,
  remarks: optionalText,
  status: z.enum(RENEWAL_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const querySchema = z.object({
  submissionId: optionalText,
  registrationId: optionalText,
  authorityId: optionalText,
  receivedDate: optionalText,
  responseDueDate: optionalText,
  queryCategory: optionalText,
  description: z.string().trim().min(2, "Description is required."),
  assignedTo: optionalText,
  remarks: optionalText,
  status: z.enum(QUERY_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const queryTaskSchema = z.object({
  department: z.string().trim().min(1, "Department is required."),
  responsiblePerson: optionalText,
  dueDate: optionalText,
  response: optionalText,
  evidence: optionalText,
  remarks: optionalText,
});

export const commitmentSchema = z.object({
  sourceType: z.enum(COMMITMENT_SOURCES).default("other"),
  sourceId: optionalText,
  description: z.string().trim().min(2, "Description is required."),
  ownerId: optionalText,
  department: optionalText,
  dueDate: optionalText,
  priority: optionalText,
  evidence: optionalText,
  remarks: optionalText,
  status: z.enum(COMMITMENT_STATUSES).optional(),
});

export const communicationSchema = z.object({
  authorityId: optionalText,
  productId: optionalText,
  registrationId: optionalText,
  submissionId: optionalText,
  communicationType: z.enum(COMMUNICATION_TYPES).default("other"),
  direction: z.enum(COMMUNICATION_DIRECTIONS).default("incoming"),
  date: optionalText,
  subject: z.string().trim().min(1, "Subject is required."),
  summary: optionalText,
  attachmentReference: optionalText,
  responsiblePerson: optionalText,
});

export const requirementSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required."),
  productId: z.string().trim().min(1, "Product is required."),
  marketId: optionalText,
  requirementType: optionalText,
  requirementDescription: z.string().trim().min(2, "Requirement is required."),
  documentRequirement: optionalText,
  testingRequirement: optionalText,
  packagingRequirement: optionalText,
  labelingRequirement: optionalText,
  status: optionalText,
});

export const artworkSchema = z.object({
  productId: z.string().trim().min(1, "Product is required."),
  customerId: optionalText,
  marketId: optionalText,
  artworkType: optionalText,
  version: optionalText,
  submissionDate: optionalText,
  expiryDate: optionalText,
  remarks: optionalText,
  status: z.enum(ARTWORK_STATUSES).optional(),
});

export const changeSchema = z.object({
  title: z.string().trim().min(2, "Title is required."),
  source: optionalText,
  effectiveDate: optionalText,
  impactAssessment: optionalText,
  affectedProducts: optionalText,
  affectedMarkets: optionalText,
  responsiblePerson: optionalText,
  changeControlId: optionalText,
  status: z.enum(CHANGE_STATUSES).optional(),
  remarks: optionalText,
});
