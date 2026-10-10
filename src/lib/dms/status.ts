export const DOCUMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ["in_review", "cancelled"],
  in_review: ["changes_requested", "rejected", "approved", "in_review"],
  changes_requested: ["in_review", "cancelled"],
  rejected: ["draft"],
  approved: ["effective", "withdrawn"],
  effective: ["withdrawn"],
  superseded: ["archived"],
  withdrawn: ["archived"],
  cancelled: ["archived"],
  archived: ["draft"],
};

export const DCR_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["in_review", "rejected", "draft"],
  in_review: ["approved", "rejected"],
  approved: ["in_implementation", "cancelled"],
  rejected: ["draft"],
  in_implementation: ["closed"],
  closed: [],
  cancelled: [],
};

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}

export function isContentEditable(status: string) {
  return status === "draft" || status === "changes_requested";
}

export function isTerminalDocument(status: string) {
  return ["superseded", "archived", "cancelled"].includes(status);
}
