export const ARTWORK_COMPONENTS = ["Carton", "Label", "Foil", "Leaflet", "Shipper", "Blister"] as const;

export const ARTWORK_LANES = [
  { key: "packaging", label: "Packaging", status: "packaging_review" },
  { key: "qa", label: "QA", status: "qa_review" },
  { key: "regulatory", label: "Regulatory", status: "regulatory_review" },
  { key: "customer", label: "Customer", status: "customer_review" },
] as const;

export type ArtworkLaneKey = (typeof ARTWORK_LANES)[number]["key"];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  packaging_review: "Packaging review",
  qa_review: "QA review",
  regulatory_review: "Regulatory review",
  customer_review: "Customer review",
  changes_requested: "Changes requested",
  approved: "Approved",
  effective: "Effective",
  obsolete: "Obsolete",
};

const STATUS_TONES = {
  draft: "neutral",
  packaging_review: "info",
  qa_review: "info",
  regulatory_review: "hold",
  customer_review: "warning",
  changes_requested: "critical",
  approved: "success",
  effective: "success",
  obsolete: "neutral",
} as const;

const DECISION_LABELS: Record<string, string> = {
  approved: "Approved",
  pending: "In review",
  changes_requested: "Changes requested",
  waiting: "Waiting",
};

const DECISION_TONES = {
  approved: "success",
  pending: "info",
  changes_requested: "critical",
  waiting: "neutral",
} as const;

export type ArtworkTone = "neutral" | "info" | "success" | "warning" | "critical" | "hold";

export function artworkStatusLabel(status: unknown) {
  const key = String(status || "");
  return STATUS_LABELS[key] || key.replaceAll("_", " ");
}

export function artworkStatusTone(status: unknown): ArtworkTone {
  return (STATUS_TONES as Record<string, ArtworkTone>)[String(status || "")] || "neutral";
}

export function artworkDecisionLabel(decision: unknown) {
  const key = String(decision || "");
  return DECISION_LABELS[key] || key.replaceAll("_", " ");
}

export function artworkDecisionTone(decision: unknown): ArtworkTone {
  return (DECISION_TONES as Record<string, ArtworkTone>)[String(decision || "")] || "neutral";
}

export function laneLabel(key: unknown) {
  return ARTWORK_LANES.find((lane) => lane.key === key)?.label || String(key || "");
}
