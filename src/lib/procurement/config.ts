/** Default over-receipt tolerance. Override per PO; never assume 5%. */
export const DEFAULT_OVER_RECEIPT_TOLERANCE_PERCENT = 0;

export const PROCUREMENT_NUMBER_SERIES = {
  REQ: { documentType: "REQ", prefix: "REQ" },
  PR: { documentType: "PR", prefix: "PR" },
  RFQ: { documentType: "RFQ", prefix: "RFQ" },
  QUO: { documentType: "QUO", prefix: "QUO" },
  SEL: { documentType: "SEL", prefix: "SEL" },
  PO: { documentType: "PO", prefix: "PO" },
  AMD: { documentType: "AMD", prefix: "AMD" },
} as const;

export const WORKFLOW_MODULES = {
  purchaseRequisition: "purchase_requisition",
  purchaseOrder: "purchase_order",
  vendorSelection: "vendor_selection",
  purchaseOrderAmendment: "purchase_order_amendment",
} as const;
