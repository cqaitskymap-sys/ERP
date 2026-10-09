import {
  CMO_STATUSES,
  PRICE_LIST_STATUSES,
  REQUIREMENT_CATEGORIES,
  REQUIREMENT_STATUSES,
  SALES_ORDER_STATUSES,
  SALES_ORDER_TYPES,
  SALES_QUOTATION_STATUSES,
  SALES_REPORT_TYPES,
  SALES_RETURN_STATUSES,
} from "@/types/sales";

function options(values: readonly string[], labels: Record<string, string> = {}) {
  return values.map((value) => ({
    value,
    label: labels[value] || value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  }));
}

export const quotationStatusOptions = options(SALES_QUOTATION_STATUSES);
export const orderStatusOptions = options(SALES_ORDER_STATUSES);
export const orderTypeOptions = options(SALES_ORDER_TYPES);
export const priceListStatusOptions = options(PRICE_LIST_STATUSES);
export const requirementStatusOptions = options(REQUIREMENT_STATUSES);
export const requirementCategoryOptions = options(REQUIREMENT_CATEGORIES);
export const cmoStatusOptions = options(CMO_STATUSES);
export const returnStatusOptions = options(SALES_RETURN_STATUSES);
export const reportTypeOptions = options(SALES_REPORT_TYPES);

export function labelFor(optionsList: Array<{ label: string; value: string }>, value: string) {
  return optionsList.find((row) => row.value === value)?.label || value || "—";
}

export function workflowTone(status: string): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  if (["approved", "confirmed", "delivered", "closed", "converted", "accepted", "active", "fulfilled"].includes(status)) {
    return "success";
  }
  if (["pending_approval", "under_review", "submitted", "negotiation", "requested"].includes(status)) {
    return "warning";
  }
  if (["on_hold"].includes(status)) return "hold";
  if (["cancelled", "rejected", "expired"].includes(status)) return "critical";
  if (["dispatched", "partially_fulfilled", "ready_for_dispatch", "sent"].includes(status)) return "info";
  return "neutral";
}
