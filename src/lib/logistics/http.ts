import { LOGISTICS_COLLECTIONS } from "@/lib/logistics/collections";
import type { Permission } from "@/types/permissions";

export const LOGISTICS_RESOURCES = {
  putaways: { collection: LOGISTICS_COLLECTIONS.putaways, read: "warehousePutaway:read" as Permission, create: "warehousePutaway:create" as Permission },
  movements: { collection: LOGISTICS_COLLECTIONS.movements, read: "inventory:read" as Permission, create: "inventory:update" as Permission },
  picks: { collection: LOGISTICS_COLLECTIONS.picks, read: "warehousePicking:read" as Permission, create: "warehousePicking:create" as Permission },
  packing: { collection: LOGISTICS_COLLECTIONS.packing, read: "warehousePacking:read" as Permission, create: "warehousePacking:create" as Permission },
  shipments: { collection: LOGISTICS_COLLECTIONS.shipments, read: "warehouseShipment:read" as Permission, create: "warehouseShipment:create" as Permission },
  returns: { collection: LOGISTICS_COLLECTIONS.returns, read: "warehouseCustomerReturn:read" as Permission, create: "warehouseCustomerReturn:create" as Permission },
  pallets: { collection: LOGISTICS_COLLECTIONS.pallets, read: "warehouse:read" as Permission, create: "warehouse:update" as Permission },
  reservations: { collection: LOGISTICS_COLLECTIONS.reservations, read: "inventory:read" as Permission, create: "inventory:update" as Permission },
  cycleCounts: { collection: LOGISTICS_COLLECTIONS.cycleCounts, read: "warehouseCycleCount:read" as Permission, create: "warehouseCycleCount:create" as Permission },
  devices: { collection: LOGISTICS_COLLECTIONS.devices, read: "warehouseColdchain:read" as Permission, create: "warehouseColdchain:create" as Permission },
  temperatures: { collection: LOGISTICS_COLLECTIONS.temperatures, read: "warehouseColdchain:read" as Permission, create: "warehouseColdchain:create" as Permission },
  excursions: { collection: LOGISTICS_COLLECTIONS.excursions, read: "warehouseExcursion:read" as Permission, create: "warehouseExcursion:create" as Permission },
  incidents: { collection: LOGISTICS_COLLECTIONS.incidents, read: "warehouse:read" as Permission, create: "warehouse:update" as Permission },
  checks: { collection: LOGISTICS_COLLECTIONS.checks, read: "warehouse:read" as Permission, create: "warehouse:update" as Permission },
  providers: { collection: LOGISTICS_COLLECTIONS.providers, read: "warehouse:read" as Permission, create: "warehouse:update" as Permission },
} as const;

export type LogisticsResource = keyof typeof LOGISTICS_RESOURCES;

export function isLogisticsResource(value: string): value is LogisticsResource {
  return value in LOGISTICS_RESOURCES;
}

export const READ_ALIASES: Record<LogisticsResource, Permission[]> = {
  putaways: ["warehousePutaway:read", "warehouse:read"],
  movements: ["inventory:read", "warehouse:read"],
  picks: ["warehousePicking:read", "warehouse:read"],
  packing: ["warehousePacking:read", "warehouse:read"],
  shipments: ["warehouseShipment:read", "warehouse:read"],
  returns: ["warehouseCustomerReturn:read", "warehouse:read"],
  pallets: ["warehouse:read"],
  reservations: ["inventory:read", "warehouse:read"],
  cycleCounts: ["warehouseCycleCount:read", "warehouse:read"],
  devices: ["warehouseColdchain:read", "warehouse:read"],
  temperatures: ["warehouseColdchain:read", "warehouse:read"],
  excursions: ["warehouseExcursion:read", "warehouse:read"],
  incidents: ["warehouse:read"],
  checks: ["warehouse:read"],
  providers: ["warehouse:read"],
};
