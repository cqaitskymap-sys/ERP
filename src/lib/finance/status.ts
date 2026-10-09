export const JOURNAL_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["pending_approval", "approved", "rejected", "draft"],
  pending_approval: ["approved", "rejected", "draft"],
  approved: ["posted", "cancelled"],
  posted: ["reversed"],
  reversed: [],
  rejected: ["draft"],
  cancelled: [],
};

export const SUPPLIER_INVOICE_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["matching", "pending_approval", "on_hold", "cancelled"],
  matching: ["exception_review", "pending_approval", "on_hold"],
  exception_review: ["matching", "pending_approval", "rejected", "on_hold"],
  pending_approval: ["approved", "rejected", "exception_review"],
  approved: ["posted", "on_hold", "cancelled"],
  posted: ["partially_paid", "paid", "on_hold"],
  partially_paid: ["paid", "on_hold"],
  paid: [],
  on_hold: ["matching", "pending_approval", "approved", "cancelled"],
  rejected: ["draft"],
  cancelled: [],
};

export const PAYMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ["proposed", "cancelled"],
  proposed: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "rejected", "proposed"],
  approved: ["submitted_manual", "awaiting_confirmation", "cancelled"],
  submitted_manual: ["awaiting_confirmation", "confirmed", "cancelled"],
  awaiting_confirmation: ["confirmed", "cancelled"],
  confirmed: ["posted"],
  posted: [],
  rejected: ["draft"],
  cancelled: [],
};

export const CUSTOMER_INVOICE_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "draft", "cancelled"],
  approved: ["posted", "cancelled"],
  posted: ["partially_paid", "paid", "disputed"],
  partially_paid: ["paid", "disputed"],
  paid: [],
  disputed: ["posted", "partially_paid", "cancelled"],
  cancelled: [],
};

export const CREDIT_NOTE_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_approval", "cancelled"],
  pending_approval: ["approved", "draft", "cancelled"],
  approved: ["posted", "cancelled"],
  posted: ["applied"],
  applied: [],
  cancelled: [],
};

export const BANK_RECON_TRANSITIONS: Record<string, string[]> = {
  imported: ["validated", "cancelled"],
  validated: ["matching", "cancelled"],
  matching: ["exception_review", "pending_approval"],
  exception_review: ["matching", "pending_approval", "cancelled"],
  pending_approval: ["completed", "exception_review"],
  completed: [],
  cancelled: [],
};

export const PERIOD_TRANSITIONS: Record<string, string[]> = {
  open: ["closing", "closed"],
  closing: ["closed", "open"],
  closed: ["reopened"],
  reopened: ["closing", "closed"],
};

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}

export function isPostedLocked(status: string) {
  return ["posted", "paid", "reversed", "completed", "applied"].includes(status);
}
