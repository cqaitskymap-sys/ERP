import { INVENTORY_COLLECTIONS } from "@/lib/inventory/collections";
import type { Permission } from "@/types/permissions";

export const WAREHOUSE_RESOURCES = {
  inventory: { collection: INVENTORY_COLLECTIONS.balances, read: "inventory:read" as Permission },
  batches: { collection: INVENTORY_COLLECTIONS.batches, read: "inventory:read" as Permission },
  receipts: { collection: INVENTORY_COLLECTIONS.receipts, read: "goodsReceipt:read" as Permission },
  transfers: { collection: INVENTORY_COLLECTIONS.transfers, read: "stockTransfer:create" as Permission },
  issues: { collection: INVENTORY_COLLECTIONS.issues, read: "stockIssue:create" as Permission },
  returns: { collection: INVENTORY_COLLECTIONS.returns, read: "stockReturn:create" as Permission },
  adjustments: { collection: INVENTORY_COLLECTIONS.adjustments, read: "stockAdjustment:create" as Permission },
  ledger: { collection: INVENTORY_COLLECTIONS.ledger, read: "inventory:read" as Permission },
} as const;

export type WarehouseResource = keyof typeof WAREHOUSE_RESOURCES;

export function isWarehouseResource(value: string): value is WarehouseResource {
  return value in WAREHOUSE_RESOURCES;
}

export const READ_ALIASES: Record<WarehouseResource, Permission[]> = {
  inventory: ["inventory:read"],
  batches: ["inventory:read"],
  receipts: ["goodsReceipt:read", "inventory:read"],
  transfers: ["stockTransfer:create", "stockTransfer:approve", "inventory:read"],
  issues: ["stockIssue:create", "stockIssue:approve", "inventory:read"],
  returns: ["stockReturn:create", "stockReturn:verify", "inventory:read"],
  adjustments: ["stockAdjustment:create", "stockAdjustment:approve", "inventory:read"],
  ledger: ["inventory:read"],
};
