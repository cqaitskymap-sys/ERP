import {
  AMENDMENT_STATUSES,
  PO_STATUSES,
  PROCUREMENT_DOCUMENT_TYPES,
  PROCUREMENT_PRIORITIES,
  PROCUREMENT_REPORT_TYPES,
  PR_STATUSES,
  QUOTATION_STATUSES,
  REQUIREMENT_SOURCES,
  REQUIREMENT_STATUSES,
  RFQ_STATUSES,
  SELECTION_REASONS,
} from "@/types/procurement";

function options(values: readonly string[], labels: Record<string, string>) {
  return values.map((value) => ({ value, label: labels[value] || value }));
}

export function labelFor(list: Array<{ label: string; value: string }>, value: unknown) {
  return list.find((item) => item.value === value)?.label || String(value || "—");
}

export const priorityOptions = options(PROCUREMENT_PRIORITIES, {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
  critical: "Critical",
});

export const requirementSourceOptions = options(REQUIREMENT_SOURCES, {
  manual: "Manual request",
  reorder: "Warehouse reorder",
  production: "Production planning",
  department: "Department request",
  maintenance: "Maintenance",
  administration: "Administration",
});

export const requirementStatusOptions = options(REQUIREMENT_STATUSES, {
  draft: "Draft",
  submitted: "Submitted",
  converted: "Converted to PR",
  cancelled: "Cancelled",
});

export const prStatusOptions = options(PR_STATUSES, {
  draft: "Draft",
  submitted: "Submitted",
  department_review: "Department Review",
  approved: "Approved",
  purchase_review: "Purchase Review",
  rfq: "RFQ",
  po: "PO",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
});

export const rfqStatusOptions = options(RFQ_STATUSES, {
  draft: "Draft",
  issued: "Issued",
  partially_responded: "Partially Responded",
  fully_responded: "Fully Responded",
  evaluation: "Evaluation",
  closed: "Closed",
  cancelled: "Cancelled",
});

export const quotationStatusOptions = options(QUOTATION_STATUSES, {
  draft: "Draft",
  received: "Received",
  under_evaluation: "Under Evaluation",
  selected: "Selected",
  not_selected: "Not Selected",
  expired: "Expired",
  cancelled: "Cancelled",
});

export const selectionReasonOptions = options(SELECTION_REASONS, {
  lowest_evaluated_cost: "Lowest evaluated cost",
  better_delivery: "Better delivery",
  approved_supplier: "Approved supplier",
  better_quality_history: "Better quality history",
  customer_requirement: "Customer requirement",
  technical_suitability: "Technical suitability",
  other: "Other",
});

export const poStatusOptions = options(PO_STATUSES, {
  draft: "Draft",
  submitted: "Submitted",
  under_approval: "Under Approval",
  approved: "Approved",
  sent: "Sent to Vendor",
  acknowledged: "Acknowledged",
  partially_received: "Partially Received",
  fully_received: "Fully Received",
  closed: "Closed",
  cancelled: "Cancelled",
});

export const amendmentStatusOptions = options(AMENDMENT_STATUSES, {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
});

export const procurementDocumentTypeOptions = options(PROCUREMENT_DOCUMENT_TYPES, {
  vendor_quotation: "Vendor Quotation",
  purchase_order: "Purchase Order",
  technical_specification: "Technical Specification",
  purchase_agreement: "Purchase Agreement",
  other: "Other",
});

export const procurementReportOptions = options(PROCUREMENT_REPORT_TYPES, {
  purchase_requisition: "Purchase Requisition Report",
  rfq: "RFQ Report",
  vendor_quotation: "Vendor Quotation Report",
  quotation_comparison: "Quotation Comparison Report",
  purchase_order: "Purchase Order Report",
  open_po: "Open PO Report",
  overdue_po: "Overdue PO Report",
  vendor_purchase: "Vendor Purchase Report",
  material_purchase: "Material Purchase Report",
  monthly_purchase: "Monthly Purchase Report",
  purchase_value: "Purchase Value Report",
  delivery_performance: "Delivery Performance Report",
});

export function workflowTone(status: unknown): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  switch (String(status || "")) {
    case "approved":
    case "completed":
    case "closed":
    case "selected":
    case "fully_received":
    case "issued":
    case "sent":
      return "success";
    case "rejected":
    case "cancelled":
    case "expired":
      return "critical";
    case "submitted":
    case "under_approval":
    case "department_review":
    case "purchase_review":
    case "evaluation":
    case "partially_received":
    case "partially_responded":
      return "warning";
    case "draft":
      return "neutral";
    default:
      return "info";
  }
}
