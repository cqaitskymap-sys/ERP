import {
  CUSTOMER_RETURN_SOURCES,
  CUSTOMER_RETURN_STATUSES,
  CYCLE_COUNT_STATUSES,
  EXCURSION_STATUSES,
  INCIDENT_TYPES,
  LOGISTICS_REPORT_TYPES,
  MOVEMENT_TYPES,
  PACK_STATUSES,
  PICK_STATUSES,
  PUTAWAY_STATUSES,
  SHIPMENT_STATUSES,
  TEMPERATURE_SOURCES,
} from "@/types/logistics";

function options(values: readonly string[]) {
  return values.map((value) => ({
    value,
    label: value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
  }));
}

export function labelFor(list: Array<{ label: string; value: string }>, value: unknown) {
  return list.find((item) => item.value === value)?.label || String(value || "—");
}

export const putawayStatusOptions = options(PUTAWAY_STATUSES);
export const movementTypeOptions = options(MOVEMENT_TYPES);
export const pickStatusOptions = options(PICK_STATUSES);
export const packStatusOptions = options(PACK_STATUSES);
export const shipmentStatusOptions = options(SHIPMENT_STATUSES);
export const returnSourceOptions = options(CUSTOMER_RETURN_SOURCES);
export const returnStatusOptions = options(CUSTOMER_RETURN_STATUSES);
export const cycleCountStatusOptions = options(CYCLE_COUNT_STATUSES);
export const excursionStatusOptions = options(EXCURSION_STATUSES);
export const temperatureSourceOptions = options(TEMPERATURE_SOURCES);
export const incidentTypeOptions = options(INCIDENT_TYPES);
export const reportTypeOptions = options(LOGISTICS_REPORT_TYPES);

export function workflowTone(status: unknown): "neutral" | "info" | "success" | "warning" | "critical" | "hold" {
  switch (String(status || "")) {
    case "confirmed":
    case "verified":
    case "complete":
    case "completed":
    case "delivered":
    case "accepted":
    case "reconciled":
    case "released":
    case "closed":
      return "success";
    case "expired":
    case "rejected":
    case "cancelled":
    case "critical":
      return "critical";
    case "quarantine":
    case "hold":
    case "delayed":
    case "potential":
      return "hold";
    case "in_progress":
    case "packing":
    case "in_transit":
    case "verification":
      return "warning";
    default:
      return "info";
  }
}
