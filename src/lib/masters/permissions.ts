import { getMasterDefinition } from "@/lib/masters/registry";
import type { MasterEntity } from "@/types/masters";
import type { Permission, PermissionAction } from "@/types/permissions";

export function masterPermission(
  entity: MasterEntity,
  action: PermissionAction
): Permission {
  const permissionModule = getMasterDefinition(entity)?.permissionModule ?? "masters";
  return `${permissionModule}:${action}`;
}

export function auditModuleFor(entity: MasterEntity) {
  return getMasterDefinition(entity)?.permissionModule ?? "masters";
}

export const TRANSACTION_BLOCKED_STATUSES = [
  "inactive",
  "blocked",
  "discontinued",
  "expired",
  "obsolete",
  "rejected",
  "suspended",
];

export function isUsableForNewTransactions(status: unknown) {
  return !TRANSACTION_BLOCKED_STATUSES.includes(String(status || ""));
}
