import { getRoleDefinition } from "@/lib/permissions/catalog";
import { PRIVILEGED_ROLES } from "@/types/permissions";
import type { AppRole, Permission } from "@/types/permissions";
import type { AccountStatus, SessionPayload, UserProfile } from "@/types/auth";

export function resolvePermissions(
  roles: AppRole[],
  explicit: Permission[] = []
): Permission[] {
  const fromRoles = roles.flatMap(
    (role) => getRoleDefinition(role)?.permissions ?? []
  );

  return Array.from(new Set([...fromRoles, ...explicit]));
}

export function hasPermission(
  granted: Permission[] | undefined,
  required?: Permission | Permission[]
) {
  if (!required) return true;
  const needed = Array.isArray(required) ? required : [required];
  return needed.every((permission) => Boolean(granted?.includes(permission)));
}

export function hasAnyPermission(
  granted: Permission[] | undefined,
  required: Permission[]
) {
  return required.some((permission) => hasPermission(granted, permission));
}

export function hasRole(
  roles: AppRole[] | undefined,
  required?: AppRole | AppRole[]
) {
  if (!required) return true;
  const needed = Array.isArray(required) ? required : [required];
  return needed.some((role) => Boolean(roles?.includes(role)));
}

export function isPrivileged(roles: AppRole[] | undefined) {
  return hasRole(roles, PRIVILEGED_ROLES);
}

export function isAccountActive(status?: AccountStatus) {
  return status === "active";
}

export function canAccess(
  subject: UserProfile | SessionPayload | null | undefined,
  required?: Permission | Permission[]
) {
  if (!subject) return false;
  if (!isAccountActive(subject.status)) return false;
  return hasPermission(subject.permissions, required);
}

export function assertPermission(
  subject: UserProfile | SessionPayload | null | undefined,
  required?: Permission | Permission[]
) {
  if (!subject) {
    const error = new Error("Authentication required.");
    error.name = "UnauthorizedError";
    throw error;
  }

  if (!isAccountActive(subject.status)) {
    const error = new Error("Account is not active.");
    error.name = "ForbiddenError";
    throw error;
  }

  if (!hasPermission(subject.permissions, required)) {
    const error = new Error("You do not have permission for this action.");
    error.name = "ForbiddenError";
    throw error;
  }
}

export function assertRole(
  subject: UserProfile | SessionPayload | null | undefined,
  required?: AppRole | AppRole[]
) {
  if (!subject) {
    const error = new Error("Authentication required.");
    error.name = "UnauthorizedError";
    throw error;
  }

  if (!isAccountActive(subject.status)) {
    const error = new Error("Account is not active.");
    error.name = "ForbiddenError";
    throw error;
  }

  if (!hasRole(subject.roles, required)) {
    const error = new Error("Your role cannot access this resource.");
    error.name = "ForbiddenError";
    throw error;
  }
}
