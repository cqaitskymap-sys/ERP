import {
  ADJUSTMENT_REASONS,
  ADJUSTMENT_STATUSES,
  CONDITION_STATUSES,
  GOODS_RECEIPT_STATUSES,
  INVENTORY_DOCUMENT_TYPES,
  INVENTORY_ITEM_TYPES,
  INVENTORY_QUALITY_STATUSES,
  INVENTORY_REPORT_TYPES,
  INVENTORY_STATUSES,
  ISSUE_STATUSES,
  LEDGER_TRANSACTION_TYPES,
  REJECTION_DISPOSITIONS,
  RETURN_REASONS,
  RETURN_STATUSES,
  TRANSFER_STATUSES,
  VERIFICATION_STATUSES,
} from "@/types/inventory";
export type InventoryTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "critical"
  | "hold";

function options(
  values: readonly string[],
  labels: Record<string, string>
): Array<{ label: string; value: string }> {
  return values.map((value) => ({ value, label: labels[value] || value }));
}

export function labelFor(
  list: Array<{ label: string; value: string }>,
  value: unknown
) {
  return list.find((item) => item.value === value)?.label || String(value || "—");
}

export const inventoryItemTypeOptions = options(INVENTORY_ITEM_TYPES, {
  material: "Material",
  finished_product: "Finished Product",
  semi_finished: "Semi Finished Product",
  bulk_product: "Bulk Product",
});

export const qualityStatusOptions = options(INVENTORY_QUALITY_STATUSES, {
  quarantine: "Quarantine",
  under_testing: "Under Testing",
  approved: "Approved",
  rejected: "Rejected",
  blocked: "Blocked",
  returned: "Returned",
  expired: "Expired",
});

export const inventoryStatusOptions = options(INVENTORY_STATUSES, {
  available: "Available",
  reserved: "Reserved",
  on_hold: "On Hold",
  blocked: "Blocked",
  expired: "Expired",
  consumed: "Consumed",
  closed: "Closed",
});

export const receiptStatusOptions = options(GOODS_RECEIPT_STATUSES, {
  draft: "Draft",
  received: "Received",
  under_inspection: "Under Inspection",
  completed: "Completed",
  cancelled: "Cancelled",
});

export const verificationStatusOptions = options(VERIFICATION_STATUSES, {
  pending: "Pending",
  verified: "Verified",
  discrepancy: "Discrepancy",
  rejected: "Rejected",
});

export const conditionOptions = options(CONDITION_STATUSES, {
  good: "Good",
  intact: "Intact",
  damaged: "Damaged",
  wet: "Wet",
  torn: "Torn",
  missing: "Missing",
  other: "Other",
});

export const transferStatusOptions = options(TRANSFER_STATUSES, {
  draft: "Draft",
  requested: "Requested",
  approved: "Approved",
  in_transit: "In Transit",
  completed: "Completed",
  cancelled: "Cancelled",
});

export const issueStatusOptions = options(ISSUE_STATUSES, {
  draft: "Draft",
  requested: "Requested",
  approved: "Approved",
  issued: "Issued",
  cancelled: "Cancelled",
});

export const returnStatusOptions = options(RETURN_STATUSES, {
  draft: "Draft",
  requested: "Requested",
  received: "Received",
  verified: "Verified",
  completed: "Completed",
  rejected: "Rejected",
});

export const adjustmentStatusOptions = options(ADJUSTMENT_STATUSES, {
  draft: "Draft",
  requested: "Requested",
  approved: "Approved",
  cancelled: "Cancelled",
});

export const adjustmentReasonOptions = options(ADJUSTMENT_REASONS, {
  physical_count: "Physical Count Difference",
  damage: "Damage",
  spillage: "Spillage",
  system_correction: "System Correction",
  expired: "Expired",
  other: "Other",
});

export const rejectionDispositionOptions = options(REJECTION_DISPOSITIONS, {
  return_to_supplier: "Return to Supplier",
  destruction: "Destruction",
  rework: "Rework",
  other: "Other",
});

export const returnReasonOptions = options(RETURN_REASONS, {
  unused: "Unused",
  excess: "Excess",
  quality_concern: "Quality Concern",
  other: "Other",
});

export const ledgerTypeOptions = options(LEDGER_TRANSACTION_TYPES, {
  RECEIPT: "Receipt",
  TRANSFER_IN: "Transfer In",
  TRANSFER_OUT: "Transfer Out",
  ISSUE: "Issue",
  RETURN: "Return",
  ADJUSTMENT_IN: "Adjustment In",
  ADJUSTMENT_OUT: "Adjustment Out",
  RELEASE: "Release",
  REJECTION: "Rejection",
  BLOCK: "Block",
  UNBLOCK: "Unblock",
  EXPIRY: "Expiry",
  CONSUMPTION: "Consumption",
});

export const inventoryDocumentTypeOptions = options(INVENTORY_DOCUMENT_TYPES, {
  coa: "Certificate of Analysis",
  packing_list: "Packing List",
  invoice: "Invoice",
  qc_report: "QC Report",
  other: "Other",
});

export const inventoryReportOptions = options(INVENTORY_REPORT_TYPES, {
  current_stock: "Current Stock",
  stock_ledger: "Stock Ledger",
  batch_stock: "Batch Stock",
  warehouse_stock: "Warehouse Stock",
  location_stock: "Location Stock",
  quarantine_stock: "Quarantine Stock",
  rejected_stock: "Rejected Stock",
  blocked_stock: "Blocked Stock",
  near_expiry: "Near Expiry",
  expired_stock: "Expired Stock",
  stock_movement: "Stock Movement",
  material_issue: "Material Issue",
  material_return: "Material Return",
  stock_adjustment: "Stock Adjustment",
  batch_traceability: "Batch Traceability",
});

export function qualityTone(status: unknown): InventoryTone {
  switch (String(status || "")) {
    case "approved":
      return "success";
    case "quarantine":
    case "under_testing":
      return "warning";
    case "rejected":
    case "expired":
      return "critical";
    case "blocked":
    case "on_hold":
      return "hold";
    case "returned":
      return "info";
    default:
      return "neutral";
  }
}

export function workflowTone(status: unknown): InventoryTone {
  switch (String(status || "")) {
    case "completed":
    case "issued":
    case "approved":
    case "verified":
    case "received":
      return "success";
    case "cancelled":
    case "rejected":
      return "critical";
    case "requested":
    case "under_inspection":
    case "in_transit":
      return "warning";
    case "draft":
      return "neutral";
    default:
      return "info";
  }
}
