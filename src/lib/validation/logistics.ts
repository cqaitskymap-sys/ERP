import { z } from "zod";
import {
  CUSTOMER_RETURN_SOURCES,
  CUSTOMER_RETURN_STATUSES,
  CYCLE_COUNT_STATUSES,
  INCIDENT_TYPES,
  MOVEMENT_TYPES,
  PACK_STATUSES,
  PICK_STATUSES,
  PUTAWAY_STATUSES,
  SHIPMENT_STATUSES,
  TEMPERATURE_SOURCES,
} from "@/types/logistics";

const optionalText = z.string().trim().optional().or(z.literal(""));

export const putawaySchema = z.object({
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  locationId: z.string().trim().min(1, "Location is required."),
  itemType: z.string().trim().min(1),
  materialId: optionalText,
  productId: optionalText,
  batchNumber: z.string().trim().min(1, "Batch is required."),
  quantity: z.coerce.number().positive(),
  sourceLocationId: optionalText,
  remarks: optionalText,
  status: z.enum(PUTAWAY_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const movementSchema = z.object({
  movementType: z.enum(MOVEMENT_TYPES).default("bin_transfer"),
  sourceWarehouseId: z.string().trim().min(1, "Source warehouse is required."),
  sourceLocationId: z.string().trim().min(1, "Source location is required."),
  destinationWarehouseId: z.string().trim().min(1, "Destination warehouse is required."),
  destinationLocationId: z.string().trim().min(1, "Destination location is required."),
  itemType: z.string().trim().min(1),
  materialId: optionalText,
  productId: optionalText,
  batchNumber: z.string().trim().min(1, "Batch is required."),
  quantity: z.coerce.number().positive(),
  reason: z.string().trim().min(2, "Reason is required."),
  status: optionalText,
  idempotencyKey: optionalText,
});

export const pickSchema = z.object({
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  customerId: optionalText,
  orderId: optionalText,
  productId: z.string().trim().min(1, "Product is required."),
  quantity: z.coerce.number().positive(),
  minShelfLifeMonths: z.coerce.number().min(0).optional(),
  assignedTo: optionalText,
  dueDate: optionalText,
  status: z.enum(PICK_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const packingSchema = z.object({
  pickId: z.string().trim().min(1, "Pick is required."),
  packageType: optionalText,
  packageCount: z.coerce.number().min(1).optional(),
  grossWeight: optionalText,
  netWeight: optionalText,
  dimensions: optionalText,
  packagingInstructions: optionalText,
  status: z.enum(PACK_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const shipmentSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required."),
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  packingId: optionalText,
  pickId: optionalText,
  orderId: optionalText,
  carrier: optionalText,
  vehicle: optionalText,
  trackingNumber: optionalText,
  shipmentDate: optionalText,
  expectedDeliveryDate: optionalText,
  origin: optionalText,
  destination: optionalText,
  temperatureControlled: z.boolean().optional(),
  minTemperature: z.coerce.number().optional(),
  maxTemperature: z.coerce.number().optional(),
  temperatureUnit: optionalText,
  status: z.enum(SHIPMENT_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const customerReturnSchema = z.object({
  customerId: z.string().trim().min(1, "Customer is required."),
  shipmentId: optionalText,
  productId: z.string().trim().min(1, "Product is required."),
  batchNumber: z.string().trim().min(1, "Batch is required."),
  quantity: z.coerce.number().positive(),
  reason: z.enum(CUSTOMER_RETURN_SOURCES).default("other"),
  remarks: optionalText,
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  locationId: z.string().trim().min(1, "Quarantine location is required."),
  status: z.enum(CUSTOMER_RETURN_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const cycleCountSchema = z.object({
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  locationId: optionalText,
  materialId: optionalText,
  productId: optionalText,
  batchNumber: optionalText,
  systemQuantity: z.coerce.number().min(0),
  countedQuantity: z.coerce.number().min(0).optional(),
  status: z.enum(CYCLE_COUNT_STATUSES).optional(),
  idempotencyKey: optionalText,
});

export const temperatureSchema = z.object({
  deviceId: optionalText,
  shipmentId: optionalText,
  warehouseId: optionalText,
  locationId: optionalText,
  temperature: z.coerce.number(),
  humidity: z.coerce.number().optional(),
  unit: optionalText,
  source: z.enum(TEMPERATURE_SOURCES).default("manual"),
  timestamp: optionalText,
});

export const excursionDecisionSchema = z.object({
  decision: z.enum(["released", "hold", "rejected"]),
  rationale: z.string().trim().min(2, "Rationale is required."),
  capaId: optionalText,
});

export const incidentSchema = z.object({
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  incidentType: z.enum(INCIDENT_TYPES).default("other"),
  description: z.string().trim().min(2, "Description is required."),
  deviationId: optionalText,
});

export const complianceSchema = z.object({
  warehouseId: z.string().trim().min(1, "Warehouse is required."),
  checklistType: z.string().trim().min(1, "Checklist type is required."),
  remarks: optionalText,
});

export const providerSchema = z.object({
  vendorId: z.string().trim().min(1, "Vendor is required."),
  serviceType: z.string().trim().min(1, "Service type is required."),
  qualificationStatus: optionalText,
  temperatureCapability: optionalText,
  regions: optionalText,
});

export const palletSchema = z.object({
  warehouseId: z.string().trim().min(1),
  locationId: optionalText,
  productId: optionalText,
  batchNumber: optionalText,
  quantity: z.coerce.number().min(0).optional(),
  shipmentId: optionalText,
});

export const reservationSchema = z.object({
  warehouseId: z.string().trim().min(1),
  locationId: z.string().trim().min(1),
  itemType: z.string().trim().min(1),
  materialId: optionalText,
  productId: optionalText,
  batchNumber: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  orderId: optionalText,
  customerId: optionalText,
  idempotencyKey: optionalText,
});
