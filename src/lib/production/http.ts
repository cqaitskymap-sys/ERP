import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";
import type { Permission } from "@/types/permissions";

export const PRODUCTION_RESOURCES = {
  plans: { collection: PRODUCTION_COLLECTIONS.plans, read: "productionPlan:read" as Permission, create: "productionPlan:create" as Permission },
  schedules: { collection: PRODUCTION_COLLECTIONS.schedules, read: "productionSchedule:read" as Permission, create: "productionSchedule:create" as Permission },
  batchPlans: { collection: PRODUCTION_COLLECTIONS.batchPlans, read: "batchPlan:read" as Permission, create: "batchPlan:create" as Permission },
  orders: { collection: PRODUCTION_COLLECTIONS.orders, read: "manufacturingOrder:read" as Permission, create: "manufacturingOrder:create" as Permission },
  boms: { collection: PRODUCTION_COLLECTIONS.boms, read: "bom:read" as Permission, create: "bom:create" as Permission },
  dispensing: { collection: PRODUCTION_COLLECTIONS.dispensing, read: "dispensingRequest:read" as Permission, create: "dispensingRequest:create" as Permission },
  workCenters: { collection: PRODUCTION_COLLECTIONS.workCenters, read: "production:read" as Permission, create: "production:create" as Permission },
  equipment: { collection: PRODUCTION_COLLECTIONS.equipment, read: "production:read" as Permission, create: "production:create" as Permission },
  bmrs: { collection: PRODUCTION_COLLECTIONS.bmrs, read: "bmr:read" as Permission, create: "bmr:create" as Permission },
  ipc: { collection: PRODUCTION_COLLECTIONS.ipc, read: "ipc:read" as Permission, create: "ipc:create" as Permission },
  yields: { collection: PRODUCTION_COLLECTIONS.yields, read: "yield:read" as Permission, create: "yield:create" as Permission },
  reconciliations: { collection: PRODUCTION_COLLECTIONS.reconciliations, read: "reconciliation:read" as Permission, create: "reconciliation:create" as Permission },
  wastage: { collection: PRODUCTION_COLLECTIONS.wastage, read: "reconciliation:read" as Permission, create: "reconciliation:create" as Permission },
  deviations: { collection: PRODUCTION_COLLECTIONS.deviations, read: "productionDeviation:read" as Permission, create: "productionDeviation:create" as Permission },
} as const;

export type ProductionResource = keyof typeof PRODUCTION_RESOURCES;

export function isProductionResource(value: string): value is ProductionResource {
  return value in PRODUCTION_RESOURCES;
}

export const READ_ALIASES: Record<ProductionResource, Permission[]> = {
  plans: ["productionPlan:read", "production:read"],
  schedules: ["productionSchedule:read", "production:read"],
  batchPlans: ["batchPlan:read", "production:read"],
  orders: ["manufacturingOrder:read", "production:read"],
  boms: ["bom:read", "production:read"],
  dispensing: ["dispensingRequest:read", "production:read"],
  workCenters: ["production:read"],
  equipment: ["production:read"],
  bmrs: ["bmr:read", "production:read"],
  ipc: ["ipc:read", "production:read"],
  yields: ["yield:read", "production:read"],
  reconciliations: ["reconciliation:read", "production:read"],
  wastage: ["reconciliation:read"],
  deviations: ["productionDeviation:read", "production:read"],
};
