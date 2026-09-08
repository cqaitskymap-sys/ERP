import type { Permission } from "@/types/permissions";

export const PARTNER_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["document_review", "rejected"],
  document_review: ["qualification", "rejected"],
  qualification: ["qa_review", "rejected"],
  qa_review: ["approved", "rejected"],
  approved: ["active"],
  rejected: ["draft"],
  active: ["suspended", "inactive", "blocked"],
  suspended: ["active", "inactive"],
  blocked: ["active"],
  inactive: ["active"],
};

export function allowedPartnerTransitions(current: string) {
  return PARTNER_TRANSITIONS[current] ?? [];
}

export function canTransitionPartner(current: string, next: string) {
  if (current === next) return true;
  return allowedPartnerTransitions(current).includes(next);
}

export function permissionForPartnerTransition(
  module: "customers" | "vendors",
  next: string
): Permission {
  if (next === "rejected") return `${module}:reject`;
  if (next === "approved" || next === "active") return `${module}:approve`;
  if (next === "qualification" || next === "qa_review") return `${module}:qualify`;
  if (next === "suspended" || next === "inactive" || next === "blocked") {
    return `${module}:delete`;
  }
  return `${module}:update`;
}

export function partnerTransitionAction(next: string) {
  if (next === "rejected") return "REJECT";
  if (next === "approved") return "APPROVE";
  if (next === "active") return "ACTIVATE";
  if (next === "suspended") return "SUSPEND";
  if (next === "inactive" || next === "blocked") return "DEACTIVATE";
  if (next === "draft") return "RESUBMIT";
  return "WORKFLOW";
}
