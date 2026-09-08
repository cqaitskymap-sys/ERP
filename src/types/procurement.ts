export const REQUIREMENT_SOURCES = [
  "manual",
  "reorder",
  "production",
  "department",
  "maintenance",
  "administration",
] as const;

export const PROCUREMENT_PRIORITIES = ["low", "normal", "high", "urgent", "critical"] as const;

export const REQUIREMENT_STATUSES = ["draft", "submitted", "converted", "cancelled"] as const;

export const PR_STATUSES = [
  "draft",
  "submitted",
  "department_review",
  "approved",
  "purchase_review",
  "rfq",
  "po",
  "completed",
  "rejected",
  "cancelled",
] as const;

export const RFQ_STATUSES = [
  "draft",
  "issued",
  "partially_responded",
  "fully_responded",
  "evaluation",
  "closed",
  "cancelled",
] as const;

export const QUOTATION_STATUSES = [
  "draft",
  "received",
  "under_evaluation",
  "selected",
  "not_selected",
  "expired",
  "cancelled",
] as const;

export const SELECTION_REASONS = [
  "lowest_evaluated_cost",
  "better_delivery",
  "approved_supplier",
  "better_quality_history",
  "customer_requirement",
  "technical_suitability",
  "other",
] as const;

export const PO_STATUSES = [
  "draft",
  "submitted",
  "under_approval",
  "approved",
  "sent",
  "acknowledged",
  "partially_received",
  "fully_received",
  "closed",
  "cancelled",
] as const;

export const AMENDMENT_STATUSES = ["draft", "submitted", "approved", "rejected", "cancelled"] as const;

export const APPROVAL_STEP_STATUSES = ["pending", "approved", "rejected", "returned", "skipped"] as const;

export const PROCUREMENT_DOCUMENT_TYPES = [
  "vendor_quotation",
  "purchase_order",
  "technical_specification",
  "purchase_agreement",
  "other",
] as const;

export const PROCUREMENT_REPORT_TYPES = [
  "purchase_requisition",
  "rfq",
  "vendor_quotation",
  "quotation_comparison",
  "purchase_order",
  "open_po",
  "overdue_po",
  "vendor_purchase",
  "material_purchase",
  "monthly_purchase",
  "purchase_value",
  "delivery_performance",
] as const;

export type RequirementSource = (typeof REQUIREMENT_SOURCES)[number];
export type ProcurementPriority = (typeof PROCUREMENT_PRIORITIES)[number];
export type PrStatus = (typeof PR_STATUSES)[number];
export type RfqStatus = (typeof RFQ_STATUSES)[number];
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
export type PoStatus = (typeof PO_STATUSES)[number];
export type SelectionReason = (typeof SELECTION_REASONS)[number];
export type ProcurementReportType = (typeof PROCUREMENT_REPORT_TYPES)[number];

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  warnings: string[];
}

export interface MoneyBreakdown {
  subtotal: number;
  discount: number;
  tax: number;
  freight: number;
  otherCharges: number;
  grandTotal: number;
}
