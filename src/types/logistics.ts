export const PUTAWAY_STATUSES = ["created", "assigned", "in_progress", "confirmed", "cancelled"] as const;
export const MOVEMENT_TYPES = [
  "warehouse_transfer",
  "bin_transfer",
  "status_change",
  "batch_transfer",
  "adjustment",
  "return",
  "quarantine",
  "release",
  "hold",
  "rejection",
  "disposal",
] as const;
export const MOVEMENT_STATUSES = ["draft", "requested", "approved", "in_progress", "completed", "cancelled"] as const;
export const PICK_STATUSES = ["created", "assigned", "in_progress", "picked", "verified", "cancelled"] as const;
export const PACK_STATUSES = ["created", "packing", "verified", "complete", "cancelled"] as const;
export const SHIPMENT_STATUSES = [
  "draft",
  "ready",
  "packed",
  "dispatched",
  "in_transit",
  "delivered",
  "delayed",
  "cancelled",
  "returned",
] as const;
export const CUSTOMER_RETURN_SOURCES = [
  "customer",
  "distributor",
  "recall",
  "delivery_error",
  "damaged_shipment",
  "temperature_excursion",
  "expired_product",
  "other",
] as const;
export const CUSTOMER_RETURN_STATUSES = [
  "requested",
  "approved",
  "in_transit",
  "received",
  "quarantine",
  "under_investigation",
  "qa_review",
  "accepted",
  "rejected",
  "disposed",
  "closed",
] as const;
export const CYCLE_COUNT_STATUSES = [
  "planned",
  "assigned",
  "counting",
  "verification",
  "approved",
  "reconciled",
  "cancelled",
] as const;
export const EXCURSION_STATUSES = [
  "potential",
  "detected",
  "notified",
  "qa_assessment",
  "investigation",
  "capa_required",
  "released",
  "hold",
  "rejected",
  "closed",
] as const;
export const TEMPERATURE_SOURCES = ["manual", "csv_import", "api", "iot", "other"] as const;
export const INCIDENT_TYPES = [
  "temperature_failure",
  "power_failure",
  "refrigeration_failure",
  "water_leakage",
  "pest",
  "storage_damage",
  "security",
  "other",
] as const;
export const INCIDENT_STATUSES = ["open", "assessment", "investigation", "corrective_action", "closed"] as const;
export const LOCATION_OPERATIONAL_STATUSES = [
  "available",
  "full",
  "blocked",
  "under_maintenance",
  "cleaning",
  "quarantine",
  "reserved",
] as const;
export const LOGISTICS_REPORT_TYPES = [
  "inventory",
  "batch_inventory",
  "warehouse_stock",
  "location_utilization",
  "quarantine",
  "hold",
  "expiry",
  "near_expiry",
  "fefo",
  "movement",
  "receiving",
  "putaway",
  "picking",
  "packing",
  "dispatch",
  "shipment",
  "customer_distribution",
  "batch_distribution",
  "recall_distribution",
  "return",
  "cycle_count",
  "variance",
  "temperature",
  "excursion",
  "cold_chain",
  "incident",
  "logistics_performance",
  "carrier_performance",
] as const;

export type LogisticsSignature = {
  signedBy: string;
  signedByEmail: string;
  signedByRole: string;
  signedAt: string;
  action: string;
  reason: string;
  signatureReference: string;
};
