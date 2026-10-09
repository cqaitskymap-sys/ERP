import { COSTING_COLLECTIONS } from "@/lib/costing/collections";
import type { Permission } from "@/types/permissions";

export const COSTING_RESOURCES = {
  standards: {
    collection: COSTING_COLLECTIONS.productStandards,
    read: "costingStandard:read" as Permission,
    create: "costingStandard:create" as Permission,
  },
  batches: {
    collection: COSTING_COLLECTIONS.batchRecords,
    read: "costingBatch:read" as Permission,
    create: "costingBatch:create" as Permission,
  },
  rateCards: {
    collection: COSTING_COLLECTIONS.rateCards,
    read: "costing:read" as Permission,
    create: "costing:update" as Permission,
  },
  allocationRules: {
    collection: COSTING_COLLECTIONS.allocationRules,
    read: "costing:read" as Permission,
    create: "costing:update" as Permission,
  },
  variances: {
    collection: COSTING_COLLECTIONS.varianceAnalyses,
    read: "costingVariance:read" as Permission,
    create: "costingVariance:review" as Permission,
  },
  investigations: {
    collection: COSTING_COLLECTIONS.varianceInvestigations,
    read: "costingVariance:read" as Permission,
    create: "costingVariance:review" as Permission,
  },
  reconciliations: {
    collection: COSTING_COLLECTIONS.reconciliations,
    read: "costing:read" as Permission,
    create: "costing:reconcile" as Permission,
  },
  settings: {
    collection: COSTING_COLLECTIONS.settings,
    read: "costing:read" as Permission,
    create: "costing:update" as Permission,
  },
} as const;

export type CostingResource = keyof typeof COSTING_RESOURCES;

export function isCostingResource(value: string): value is CostingResource {
  return value in COSTING_RESOURCES;
}

export const READ_ALIASES: Record<CostingResource, Permission[]> = {
  standards: ["costingStandard:read", "costing:read"],
  batches: ["costingBatch:read", "costing:read"],
  rateCards: ["costing:read"],
  allocationRules: ["costing:read"],
  variances: ["costingVariance:read", "costing:read"],
  investigations: ["costingVariance:read", "costing:read"],
  reconciliations: ["costing:read", "costing:reconcile"],
  settings: ["costing:read", "costing:update"],
};
