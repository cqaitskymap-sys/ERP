export const INVENTORY_ITEM_TYPES = [
  "material",
  "finished_product",
  "semi_finished",
  "bulk_product",
] as const;

export const INVENTORY_QUALITY_STATUSES = [
  "quarantine",
  "under_testing",
  "approved",
  "rejected",
  "blocked",
  "returned",
  "expired",
] as const;

export const INVENTORY_STATUSES = [
  "available",
  "reserved",
  "on_hold",
  "blocked",
  "expired",
  "allocated",
  "picked",
  "packed",
  "dispatched",
  "in_transit",
  "delivered",
  "consumed",
  "closed",
] as const;

export const GOODS_RECEIPT_STATUSES = [
  "draft",
  "received",
  "under_inspection",
  "completed",
  "cancelled",
] as const;

export const VERIFICATION_STATUSES = [
  "pending",
  "verified",
  "discrepancy",
  "rejected",
] as const;

export const CONDITION_STATUSES = [
  "good",
  "intact",
  "damaged",
  "wet",
  "torn",
  "missing",
  "other",
] as const;

export const TRANSFER_STATUSES = [
  "draft",
  "requested",
  "approved",
  "in_transit",
  "completed",
  "cancelled",
] as const;

export const ISSUE_STATUSES = [
  "draft",
  "requested",
  "approved",
  "issued",
  "cancelled",
] as const;

export const RETURN_STATUSES = [
  "draft",
  "requested",
  "received",
  "verified",
  "completed",
  "rejected",
] as const;

export const ADJUSTMENT_STATUSES = [
  "draft",
  "requested",
  "approved",
  "cancelled",
] as const;

export const ADJUSTMENT_REASONS = [
  "physical_count",
  "damage",
  "spillage",
  "system_correction",
  "expired",
  "other",
] as const;

export const REJECTION_DISPOSITIONS = [
  "return_to_supplier",
  "destruction",
  "rework",
  "other",
] as const;

export const RETURN_REASONS = [
  "unused",
  "excess",
  "quality_concern",
  "other",
] as const;

export const LEDGER_TRANSACTION_TYPES = [
  "RECEIPT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "ISSUE",
  "RETURN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "RELEASE",
  "REJECTION",
  "BLOCK",
  "UNBLOCK",
  "EXPIRY",
  "CONSUMPTION",
  "PUTAWAY",
  "RESERVE",
  "UNRESERVE",
  "PICK",
  "PACK",
  "SHIP",
  "RETURN_IN",
] as const;

export const INVENTORY_SOURCE_TYPES = [
  "goods_receipt",
  "transfer",
  "return",
  "adjustment",
  "production",
  "other",
] as const;

export const INVENTORY_EXPIRY_WINDOWS = [7, 30, 60, 90] as const;

export const INVENTORY_DOCUMENT_TYPES = [
  "coa",
  "packing_list",
  "invoice",
  "qc_report",
  "other",
] as const;

export const INVENTORY_REPORT_TYPES = [
  "current_stock",
  "stock_ledger",
  "batch_stock",
  "warehouse_stock",
  "location_stock",
  "quarantine_stock",
  "rejected_stock",
  "blocked_stock",
  "near_expiry",
  "expired_stock",
  "stock_movement",
  "material_issue",
  "material_return",
  "stock_adjustment",
  "batch_traceability",
] as const;

export type InventoryItemType = (typeof INVENTORY_ITEM_TYPES)[number];
export type InventoryQualityStatus = (typeof INVENTORY_QUALITY_STATUSES)[number];
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];
export type GoodsReceiptStatus = (typeof GOODS_RECEIPT_STATUSES)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
export type ReturnStatus = (typeof RETURN_STATUSES)[number];
export type AdjustmentStatus = (typeof ADJUSTMENT_STATUSES)[number];
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];
export type RejectionDisposition = (typeof REJECTION_DISPOSITIONS)[number];
export type LedgerTransactionType = (typeof LEDGER_TRANSACTION_TYPES)[number];
export type InventoryExpiryWindow = (typeof INVENTORY_EXPIRY_WINDOWS)[number];
export type InventoryReportType = (typeof INVENTORY_REPORT_TYPES)[number];

export type InventoryExpiryState =
  | "expired"
  | "expiring_7"
  | "expiring_30"
  | "expiring_60"
  | "expiring_90"
  | "valid"
  | "none";

export interface InventoryBalanceKeyInput {
  itemType: InventoryItemType | string;
  itemId: string;
  batchNumber: string;
  warehouseId: string;
  locationId: string;
  qualityStatus: InventoryQualityStatus | string;
}

export interface FefoCandidate {
  id: string;
  inventoryBatchId?: string;
  itemId: string;
  itemType: string;
  batchNumber: string;
  lotNumber?: string;
  warehouseId: string;
  locationId: string;
  qualityStatus: string;
  inventoryStatus: string;
  availableQuantity: number;
  expiryDate?: string | null;
  uom?: string;
}

export interface FefoSelection {
  allocations: Array<FefoCandidate & { allocatedQuantity: number }>;
  remainingQuantity: number;
}
