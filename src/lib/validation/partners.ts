import { z } from "zod";
import {
  ADDRESS_TYPES,
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  CUSTOMER_DOCUMENT_TYPES,
  CUSTOMER_QUALIFICATION_TYPES,
  COMMERCIAL_CUSTOMER_APPROVAL_STATUSES,
  CUSTOMER_TYPES,
  DOCUMENT_STATUSES,
  PARTNER_STATUSES,
  QUALIFICATION_STATUSES,
  RISK_CATEGORIES,
  VENDOR_DOCUMENT_TYPES,
  VENDOR_MATERIAL_ROLES,
  VENDOR_QUALIFICATION_TYPES,
  VENDOR_TYPES,
} from "@/types/partners";

const optionalText = z.string().trim().optional().or(z.literal(""));
const optionalEmail = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .optional()
  .or(z.literal(""));
const optionalPhone = z
  .string()
  .trim()
  .regex(/^$|^[+0-9()\-\s]{7,20}$/, "Enter a valid phone number.")
  .optional()
  .or(z.literal(""));
const gstNumber = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^$|^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid GSTIN.")
  .optional();
const panNumber = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^$|^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN.")
  .optional();

function dateRangeRefine<T extends { effectiveFrom?: string; effectiveTo?: string }>(
  schema: z.ZodType<T>
) {
  return schema.refine(
    (value) => !value.effectiveTo || !value.effectiveFrom || value.effectiveTo >= value.effectiveFrom,
    {
      message: "Effective to cannot be earlier than effective from.",
      path: ["effectiveTo"],
    }
  );
}

function expiryRefine<T extends { effectiveDate?: string; expiryDate?: string; startDate?: string; endDate?: string }>(
  schema: z.ZodType<T>
) {
  return schema.refine(
    (value) => {
      const start = value.effectiveDate || value.startDate;
      const end = value.expiryDate || value.endDate;
      return !start || !end || end >= start;
    },
    {
      message: "Expiry / end date cannot be earlier than the effective / start date.",
      path: ["expiryDate"],
    }
  );
}

export const customerSchema = z.object({
  customerCode: optionalText,
  customerName: z.string().trim().min(2, "Customer name is required."),
  legalName: optionalText,
  customerType: z.enum(CUSTOMER_TYPES).default("contract_customer"),
  industry: optionalText,
  country: optionalText,
  state: optionalText,
  city: optionalText,
  addressLine1: optionalText,
  addressLine2: optionalText,
  postalCode: optionalText,
  website: optionalText,
  primaryContactName: optionalText,
  primaryContactDesignation: optionalText,
  primaryContactEmail: optionalEmail,
  primaryContactPhone: optionalPhone,
  secondaryContactName: optionalText,
  secondaryContactEmail: optionalEmail,
  secondaryContactPhone: optionalPhone,
  gstNumber,
  panNumber,
  taxId: optionalText,
  registrationNumber: optionalText,
  market: optionalText,
  status: z.enum(PARTNER_STATUSES).default("draft"),
  qualificationStatus: z.enum(QUALIFICATION_STATUSES).default("not_started"),
  riskCategory: z.enum(RISK_CATEGORIES).optional().or(z.literal("")),
  accountManager: optionalText,
  salesRepresentative: optionalText,
  creditLimit: z.coerce.number().min(0).optional(),
  outstandingBalance: z.coerce.number().min(0).optional(),
  overdueBalance: z.coerce.number().min(0).optional(),
  paymentTerms: optionalText,
  currency: optionalText,
  creditHold: z.boolean().optional(),
  minShelfLifeMonths: z.coerce.number().min(0).optional(),
  deliveryInstructions: optionalText,
  commercialApprovalStatus: z.enum(COMMERCIAL_CUSTOMER_APPROVAL_STATUSES).optional().or(z.literal("")),
  requiredRegulatoryDocuments: optionalText,
  remarks: optionalText,
});

export const vendorSchema = z.object({
  vendorCode: optionalText,
  vendorName: z.string().trim().min(2, "Vendor name is required."),
  legalName: optionalText,
  vendorType: z.enum(VENDOR_TYPES).default("other"),
  manufacturer: z.boolean().default(false),
  distributor: z.boolean().default(false),
  supplier: z.boolean().default(true),
  serviceProvider: z.boolean().default(false),
  country: optionalText,
  state: optionalText,
  city: optionalText,
  addressLine1: optionalText,
  addressLine2: optionalText,
  postalCode: optionalText,
  website: optionalText,
  primaryContactName: optionalText,
  primaryContactDesignation: optionalText,
  primaryContactEmail: optionalEmail,
  primaryContactPhone: optionalPhone,
  gstNumber,
  panNumber,
  taxId: optionalText,
  registrationNumber: optionalText,
  status: z.enum(PARTNER_STATUSES).default("draft"),
  qualificationStatus: z.enum(QUALIFICATION_STATUSES).default("not_started"),
  riskCategory: z.enum(RISK_CATEGORIES).optional().or(z.literal("")),
  remarks: optionalText,
});

export const partnerContactSchema = z.object({
  parentType: z.enum(["customer", "vendor"]).optional(),
  parentId: optionalText,
  customerId: optionalText,
  vendorId: optionalText,
  name: z.string().trim().min(2, "Contact name is required."),
  designation: optionalText,
  department: optionalText,
  email: optionalEmail,
  phone: optionalPhone,
  mobile: optionalPhone,
  preferredContact: z.boolean().default(false),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const partnerAddressSchema = z.object({
  parentType: z.enum(["customer", "vendor"]).optional(),
  parentId: optionalText,
  customerId: optionalText,
  vendorId: optionalText,
  addressType: z.enum(ADDRESS_TYPES),
  addressLine1: z.string().trim().min(2, "Address is required."),
  addressLine2: optionalText,
  city: optionalText,
  state: optionalText,
  country: optionalText,
  postalCode: optionalText,
  status: z.enum(["active", "inactive"]).default("active"),
});

export const customerQualificationSchema = expiryRefine(
  z.object({
    customerId: z.string().trim().min(1, "Customer is required."),
    qualificationType: z.enum(CUSTOMER_QUALIFICATION_TYPES),
    riskCategory: z.enum(RISK_CATEGORIES).optional().or(z.literal("")),
    assessmentDate: optionalText,
    reviewer: optionalText,
    reviewComments: optionalText,
    requiredDocuments: optionalText,
    submittedDocuments: optionalText,
    qualificationScore: z.coerce.number().min(0).max(100).optional(),
    qualificationStatus: z.enum(QUALIFICATION_STATUSES).default("not_started"),
    expiryDate: optionalText,
    nextReviewDate: optionalText,
    remarks: optionalText,
    status: z.enum(["active", "inactive"]).default("active"),
  })
);

export const vendorQualificationSchema = expiryRefine(
  z.object({
    vendorId: z.string().trim().min(1, "Vendor is required."),
    qualificationType: z.enum(VENDOR_QUALIFICATION_TYPES),
    assessmentDate: optionalText,
    reviewer: optionalText,
    riskCategory: z.enum(RISK_CATEGORIES).optional().or(z.literal("")),
    qualificationScore: z.coerce.number().min(0).max(100).optional(),
    findings: optionalText,
    requiredActions: optionalText,
    documents: optionalText,
    approvalStatus: z.enum(QUALIFICATION_STATUSES).default("not_started"),
    expiryDate: optionalText,
    nextReviewDate: optionalText,
    remarks: optionalText,
    status: z.enum(["active", "inactive"]).default("active"),
  })
);

export const customerDocumentSchema = expiryRefine(
  z.object({
    customerId: z.string().trim().min(1, "Customer is required."),
    documentType: z.enum(CUSTOMER_DOCUMENT_TYPES),
    documentNumber: optionalText,
    version: optionalText,
    fileName: optionalText,
    storagePath: optionalText,
    contentType: optionalText,
    fileSize: z.coerce.number().min(0).optional(),
    effectiveDate: optionalText,
    expiryDate: optionalText,
    remarks: optionalText,
    status: z.enum(DOCUMENT_STATUSES).default("draft"),
  })
);

export const vendorDocumentSchema = expiryRefine(
  z.object({
    vendorId: z.string().trim().min(1, "Vendor is required."),
    documentType: z.enum(VENDOR_DOCUMENT_TYPES),
    documentNumber: optionalText,
    version: optionalText,
    fileName: optionalText,
    storagePath: optionalText,
    contentType: optionalText,
    fileSize: z.coerce.number().min(0).optional(),
    effectiveDate: optionalText,
    expiryDate: optionalText,
    remarks: optionalText,
    status: z.enum(DOCUMENT_STATUSES).default("draft"),
  })
);

export const customerContractSchema = expiryRefine(
  z.object({
    contractNumber: z.string().trim().min(1, "Contract number is required."),
    customerId: z.string().trim().min(1, "Customer is required."),
    contractType: z.enum(CONTRACT_TYPES),
    title: z.string().trim().min(2, "Title is required."),
    description: optionalText,
    startDate: optionalText,
    endDate: optionalText,
    renewalDate: optionalText,
    commercialReference: optionalText,
    qualityAgreementReference: optionalText,
    regulatoryReference: optionalText,
    remarks: optionalText,
    status: z.enum(CONTRACT_STATUSES).default("draft"),
  })
);

export const vendorContractSchema = expiryRefine(
  z.object({
    contractNumber: z.string().trim().min(1, "Contract number is required."),
    vendorId: z.string().trim().min(1, "Vendor is required."),
    contractType: z.enum(CONTRACT_TYPES),
    title: z.string().trim().min(2, "Title is required."),
    description: optionalText,
    startDate: optionalText,
    endDate: optionalText,
    renewalDate: optionalText,
    remarks: optionalText,
    status: z.enum(CONTRACT_STATUSES).default("draft"),
  })
);

export const vendorMaterialSchema = dateRangeRefine(
  z.object({
    vendorId: z.string().trim().min(1, "Vendor is required."),
    materialId: z.string().trim().min(1, "Material is required."),
    supplierMaterialCode: optionalText,
    manufacturerName: optionalText,
    manufacturerCode: optionalText,
    approvedSupplier: z.boolean().default(false),
    preferredSupplier: z.boolean().default(false),
    supplierPriority: z.coerce.number().int().min(1).default(1),
    supplierRole: z.enum(VENDOR_MATERIAL_ROLES).default("approved"),
    leadTimeDays: z.coerce.number().min(0).optional(),
    minimumOrderQuantity: z.coerce.number().min(0).optional(),
    maximumOrderQuantity: z.coerce.number().min(0).optional(),
    effectiveFrom: optionalText,
    effectiveTo: optionalText,
    remarks: optionalText,
    status: z.enum(["active", "inactive", "blocked"]).default("active"),
  })
);

export const vendorPerformanceSchema = z.object({
  vendorId: z.string().trim().min(1, "Vendor is required."),
  evaluationPeriod: z.string().trim().min(1, "Evaluation period is required."),
  qualityScore: z.coerce.number().min(0).max(100).optional(),
  deliveryScore: z.coerce.number().min(0).max(100).optional(),
  documentationScore: z.coerce.number().min(0).max(100).optional(),
  overallScore: z.coerce.number().min(0).max(100).optional(),
  complaintCount: z.coerce.number().min(0).optional(),
  rejectionCount: z.coerce.number().min(0).optional(),
  onTimeDelivery: z.coerce.number().min(0).max(100).optional(),
  evaluator: optionalText,
  evaluationDate: optionalText,
  remarks: optionalText,
  status: z.enum(["active", "inactive"]).default("active"),
});
