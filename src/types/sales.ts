export const SALES_QUOTATION_STATUSES = [
  "draft",
  "internal_review",
  "pending_approval",
  "approved",
  "sent",
  "negotiation",
  "accepted",
  "rejected",
  "expired",
  "converted",
  "cancelled",
] as const;

export const SALES_ORDER_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "pending_approval",
  "approved",
  "confirmed",
  "on_hold",
  "in_production",
  "awaiting_qa_release",
  "ready_for_dispatch",
  "partially_fulfilled",
  "dispatched",
  "partially_delivered",
  "delivered",
  "cancelled",
  "closed",
] as const;

export const SALES_ORDER_TYPES = [
  "standard",
  "export",
  "contract_manufacturing",
  "sample",
  "replacement",
  "other",
] as const;

export const PRICE_LIST_STATUSES = ["draft", "active", "superseded", "expired", "cancelled"] as const;

export const REQUIREMENT_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "active",
  "superseded",
  "rejected",
  "expired",
] as const;

export const REQUIREMENT_CATEGORIES = [
  "approved_products",
  "packaging",
  "label_artwork",
  "batch_documentation",
  "coa",
  "batch_release",
  "minimum_shelf_life",
  "storage_transport",
  "shipping_documentation",
  "manufacturing",
  "regulatory_market",
  "quality_agreement",
  "delivery_packaging",
  "other",
] as const;

export const CMO_STATUSES = [
  "draft",
  "submitted",
  "technical_review",
  "regulatory_review",
  "qa_review",
  "commercially_confirmed",
  "linked_to_production",
  "in_production",
  "awaiting_qa_release",
  "ready_for_dispatch",
  "fulfilled",
  "cancelled",
  "closed",
] as const;

export const SALES_RETURN_STATUSES = [
  "requested",
  "sales_review",
  "qa_assessment",
  "authorized",
  "received",
  "quarantine",
  "qa_disposition",
  "commercial_resolution",
  "closed",
  "rejected",
  "cancelled",
] as const;

export const RETURN_RESOLUTIONS = [
  "replacement",
  "credit_note_reference",
  "refund_reference",
  "rejection",
  "investigation",
  "other",
] as const;

export const COMMUNICATION_TYPES = [
  "quotation",
  "order_confirmation",
  "delivery_update",
  "missing_documents",
  "specification_approval",
  "dispatch_notification",
  "delivery_confirmation",
  "payment_reminder",
  "order_change",
  "other",
] as const;

export const COMMUNICATION_DELIVERY_STATUSES = [
  "draft",
  "queued",
  "recorded",
  "pending_external",
  "failed",
] as const;

export const CREDIT_REVIEW_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "override_approved",
  "cancelled",
] as const;

export const SALES_REPORT_TYPES = [
  "sales_order_register",
  "customer_sales",
  "product_sales",
  "monthly_sales",
  "yearly_sales",
  "order_fulfilment",
  "delayed_orders",
  "pending_approvals",
  "open_orders",
  "cancelled_orders",
  "partial_fulfilment",
  "sales_rep_performance",
  "quotation_conversion",
  "customer_balances",
  "returns",
  "cmo_status",
] as const;

export const COMMERCIAL_APPROVAL_STATUSES = [
  "not_required",
  "pending",
  "approved",
  "rejected",
  "conditional",
] as const;

export type SalesQuotationStatus = (typeof SALES_QUOTATION_STATUSES)[number];
export type SalesOrderStatus = (typeof SALES_ORDER_STATUSES)[number];
export type SalesOrderType = (typeof SALES_ORDER_TYPES)[number];
export type PriceListStatus = (typeof PRICE_LIST_STATUSES)[number];
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];
export type CmoStatus = (typeof CMO_STATUSES)[number];
export type SalesReturnStatus = (typeof SALES_RETURN_STATUSES)[number];
export type ReturnResolution = (typeof RETURN_RESOLUTIONS)[number];
export type CommunicationType = (typeof COMMUNICATION_TYPES)[number];
export type SalesReportType = (typeof SALES_REPORT_TYPES)[number];

export interface SalesMoneyBreakdown {
  subtotal: number;
  discount: number;
  tax: number;
  freight: number;
  otherCharges: number;
  grandTotal: number;
}

export interface SalesOrderBlocker {
  code: string;
  label: string;
  severity: "info" | "warning" | "blocking";
}

export interface FulfilmentTotals {
  orderedQuantity: number;
  reservedQuantity: number;
  allocatedQuantity: number;
  pickedQuantity: number;
  dispatchedQuantity: number;
  deliveredQuantity: number;
  remainingQuantity: number;
  fulfilmentPercent: number;
}
