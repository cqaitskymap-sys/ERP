export const CUSTOMER_TYPES = [
  "domestic",
  "export",
  "distributor",
  "stockist",
  "hospital",
  "institution",
  "marketing_company",
  "pharma_company",
  "brand_owner",
  "contract_customer",
  "third_party_manufacturing",
  "other",
] as const;

export const COMMERCIAL_CUSTOMER_APPROVAL_STATUSES = [
  "not_started",
  "pending",
  "approved",
  "rejected",
  "conditional",
] as const;

export const PARTNER_STATUSES = [
  "draft",
  "submitted",
  "document_review",
  "qualification",
  "qa_review",
  "approved",
  "active",
  "rejected",
  "inactive",
  "blocked",
  "suspended",
] as const;

export const QUALIFICATION_STATUSES = [
  "not_started",
  "under_review",
  "qualified",
  "conditionally_qualified",
  "rejected",
  "expired",
  "suspended",
] as const;

export const RISK_CATEGORIES = ["low", "medium", "high", "critical"] as const;

export const CUSTOMER_QUALIFICATION_TYPES = [
  "new_customer",
  "periodic_review",
  "requalification",
  "export_customer",
  "other",
] as const;

export const VENDOR_TYPES = [
  "raw_material_supplier",
  "api_supplier",
  "excipient_supplier",
  "packaging_supplier",
  "printed_material_supplier",
  "equipment_supplier",
  "service_provider",
  "contract_service_provider",
  "other",
] as const;

export const VENDOR_QUALIFICATION_TYPES = [
  "initial",
  "requalification",
  "periodic_review",
  "audit_qualification",
  "emergency",
  "other",
] as const;

export const CUSTOMER_DOCUMENT_TYPES = [
  "customer_agreement",
  "contract",
  "license",
  "registration",
  "tax_document",
  "quality_agreement",
  "confidentiality_agreement",
  "product_specification",
  "artwork",
  "regulatory_document",
  "other",
] as const;

export const VENDOR_DOCUMENT_TYPES = [
  "vendor_license",
  "gmp_certificate",
  "manufacturing_license",
  "iso_certificate",
  "regulatory_certificate",
  "quality_agreement",
  "audit_report",
  "specification",
  "coa_sample",
  "questionnaire",
  "tax_document",
  "bank_document",
  "other",
] as const;

export const DOCUMENT_STATUSES = [
  "draft",
  "active",
  "expired",
  "superseded",
  "obsolete",
] as const;

export const CONTRACT_TYPES = [
  "manufacturing_agreement",
  "supply_agreement",
  "quality_agreement",
  "confidentiality_agreement",
  "service_agreement",
  "other",
] as const;

export const CONTRACT_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "active",
  "expired",
  "terminated",
  "suspended",
] as const;

export const ADDRESS_TYPES = [
  "registered_office",
  "billing",
  "shipping",
  "manufacturing_site",
  "warehouse",
  "other",
] as const;

export const VENDOR_MATERIAL_ROLES = [
  "approved",
  "preferred",
  "alternate",
  "conditional",
  "blocked",
] as const;

export const PARENT_TYPES = ["customer", "vendor"] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export type QualificationStatus = (typeof QUALIFICATION_STATUSES)[number];
export type RiskCategory = (typeof RISK_CATEGORIES)[number];
export type VendorType = (typeof VENDOR_TYPES)[number];
