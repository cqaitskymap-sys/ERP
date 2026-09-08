export const INVENTORY_COLLECTIONS = {
  batches: "inventoryBatches",
  balances: "inventoryBalances",
  receipts: "goodsReceipts",
  receiptItems: "goodsReceiptItems",
  transfers: "stockTransfers",
  transferItems: "stockTransferItems",
  issues: "stockIssues",
  issueItems: "stockIssueItems",
  returns: "stockReturns",
  returnItems: "stockReturnItems",
  adjustments: "stockAdjustments",
  ledger: "stockLedger",
  statusHistory: "inventoryStatusHistory",
  traceability: "batchTraceability",
  rejections: "stockRejections",
  documents: "inventoryDocuments",
  idempotency: "inventoryIdempotency",
  notifications: "notifications",
} as const;

export const INVENTORY_NUMBER_SERIES = {
  GRN: { documentType: "GRN", prefix: "GRN" },
  TRF: { documentType: "TRF", prefix: "TRF" },
  ISS: { documentType: "ISS", prefix: "ISS" },
  RET: { documentType: "RET", prefix: "RET" },
  ADJ: { documentType: "ADJ", prefix: "ADJ" },
  LED: { documentType: "LED", prefix: "LED" },
} as const;

export type InventoryCollection = (typeof INVENTORY_COLLECTIONS)[keyof typeof INVENTORY_COLLECTIONS];
