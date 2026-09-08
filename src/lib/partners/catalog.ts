import {
  ADDRESS_TYPES,
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  CUSTOMER_DOCUMENT_TYPES,
  CUSTOMER_QUALIFICATION_TYPES,
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

function options(
  values: readonly string[],
  labels: Record<string, string>
): Array<{ label: string; value: string }> {
  return values.map((value) => ({ value, label: labels[value] || value }));
}

export const customerTypeOptions = options(CUSTOMER_TYPES, {
  domestic: "Domestic",
  export: "Export",
  distributor: "Distributor",
  marketing_company: "Marketing Company",
  pharma_company: "Pharma Company",
  contract_customer: "Contract Customer",
  other: "Other",
});

export const partnerStatusOptions = options(PARTNER_STATUSES, {
  draft: "Draft",
  submitted: "Submitted",
  document_review: "Document Review",
  qualification: "Qualification",
  qa_review: "QA / Authorized Review",
  approved: "Approved",
  active: "Active",
  rejected: "Rejected",
  inactive: "Inactive",
  blocked: "Blocked",
  suspended: "Suspended",
});

export const qualificationStatusOptions = options(QUALIFICATION_STATUSES, {
  not_started: "Not Started",
  under_review: "Under Review",
  qualified: "Qualified",
  conditionally_qualified: "Conditionally Qualified",
  rejected: "Rejected",
  expired: "Expired",
  suspended: "Suspended",
});

export const riskOptions = options(RISK_CATEGORIES, {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
});

export const customerQualificationTypeOptions = options(CUSTOMER_QUALIFICATION_TYPES, {
  new_customer: "New Customer Qualification",
  periodic_review: "Periodic Review",
  requalification: "Requalification",
  export_customer: "Export Customer Qualification",
  other: "Other",
});

export const vendorTypeOptions = options(VENDOR_TYPES, {
  raw_material_supplier: "Raw Material Supplier",
  api_supplier: "API Supplier",
  excipient_supplier: "Excipient Supplier",
  packaging_supplier: "Packaging Supplier",
  printed_material_supplier: "Printed Material Supplier",
  equipment_supplier: "Equipment Supplier",
  service_provider: "Service Provider",
  contract_service_provider: "Contract Service Provider",
  other: "Other",
});

export const vendorQualificationTypeOptions = options(VENDOR_QUALIFICATION_TYPES, {
  initial: "Initial Qualification",
  requalification: "Requalification",
  periodic_review: "Periodic Review",
  audit_qualification: "Audit Qualification",
  emergency: "Emergency Qualification",
  other: "Other",
});

export const customerDocumentTypeOptions = options(CUSTOMER_DOCUMENT_TYPES, {
  customer_agreement: "Customer Agreement",
  contract: "Contract",
  license: "License",
  registration: "Registration",
  tax_document: "Tax Document",
  quality_agreement: "Quality Agreement",
  confidentiality_agreement: "Confidentiality Agreement",
  product_specification: "Product Specification",
  artwork: "Artwork",
  regulatory_document: "Regulatory Document",
  other: "Other",
});

export const vendorDocumentTypeOptions = options(VENDOR_DOCUMENT_TYPES, {
  vendor_license: "Vendor License",
  gmp_certificate: "GMP Certificate",
  manufacturing_license: "Manufacturing License",
  iso_certificate: "ISO Certificate",
  regulatory_certificate: "Regulatory Certificate",
  quality_agreement: "Quality Agreement",
  audit_report: "Audit Report",
  specification: "Specification",
  coa_sample: "COA Sample",
  questionnaire: "Questionnaire",
  tax_document: "Tax Document",
  bank_document: "Bank Document",
  other: "Other",
});

export const documentStatusOptions = options(DOCUMENT_STATUSES, {
  draft: "Draft",
  active: "Active",
  expired: "Expired",
  superseded: "Superseded",
  obsolete: "Obsolete",
});

export const contractTypeOptions = options(CONTRACT_TYPES, {
  manufacturing_agreement: "Manufacturing Agreement",
  supply_agreement: "Supply Agreement",
  quality_agreement: "Quality Agreement",
  confidentiality_agreement: "Confidentiality Agreement",
  service_agreement: "Service Agreement",
  other: "Other",
});

export const contractStatusOptions = options(CONTRACT_STATUSES, {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  active: "Active",
  expired: "Expired",
  terminated: "Terminated",
  suspended: "Suspended",
});

export const addressTypeOptions = options(ADDRESS_TYPES, {
  registered_office: "Registered Office",
  billing: "Billing",
  shipping: "Shipping",
  manufacturing_site: "Manufacturing Site",
  warehouse: "Warehouse",
  other: "Other",
});

export const vendorMaterialRoleOptions = options(VENDOR_MATERIAL_ROLES, {
  approved: "Approved",
  preferred: "Preferred",
  alternate: "Alternate",
  conditional: "Conditional",
  blocked: "Blocked",
});

export function labelFor(
  optionsList: Array<{ label: string; value: string }>,
  value: unknown
) {
  return optionsList.find((item) => item.value === value)?.label || String(value || "—");
}

export function riskTone(value: unknown) {
  if (value === "critical") return "critical" as const;
  if (value === "high") return "warning" as const;
  if (value === "medium") return "info" as const;
  if (value === "low") return "success" as const;
  return "neutral" as const;
}
