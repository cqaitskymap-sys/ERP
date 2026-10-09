/** Default discount % requiring manager approval. Configurable via salesSettings. */
export const DEFAULT_DISCOUNT_APPROVAL_THRESHOLD_PERCENT = 5;

/** Order value (INR) above which finance review is required by default. */
export const DEFAULT_FINANCE_REVIEW_ORDER_VALUE = 500000;

/** Credit utilization % above which a credit review is required. */
export const DEFAULT_CREDIT_UTILIZATION_THRESHOLD_PERCENT = 90;

export const SALES_NUMBER_SERIES = {
  QT: { documentType: "QT", prefix: "QT" },
  SO: { documentType: "SO", prefix: "SO" },
  CMO: { documentType: "CMO", prefix: "CMO" },
  SR: { documentType: "SR", prefix: "SR" },
  PL: { documentType: "PL", prefix: "PL" },
  REQ: { documentType: "SCREQ", prefix: "SCREQ" },
  CR: { documentType: "SCR", prefix: "SCR" },
} as const;

export const WORKFLOW_MODULES = {
  salesQuotation: "sales_quotation",
  salesOrder: "sales_order",
  salesReturn: "sales_return",
  contractManufacturing: "contract_manufacturing_order",
  salesCreditOverride: "sales_credit_override",
  salesPriceList: "sales_price_list",
} as const;
