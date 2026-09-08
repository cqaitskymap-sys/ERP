import { resolvePermissions, canAccess, hasPermission } from "../src/lib/permissions/permission-service";
import type { UserProfile } from "../src/types/auth";

function profile(role: "super_admin" | "viewer" | "qa"): UserProfile {
  return {
    uid: role,
    employeeId: "EMP",
    name: role,
    email: `${role}@test`,
    phone: null,
    department: null,
    designation: null,
    role,
    roles: [role],
    status: "active",
    photoURL: null,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    permissions: resolvePermissions([role]),
  };
}

const admin = profile("super_admin");
const viewer = profile("viewer");
const qa = profile("qa");
const inactive = { ...viewer, status: "inactive" as const };

const cases = [
  ["admin users:read", canAccess(admin, "users:read"), true],
  ["viewer users:read", canAccess(viewer, "users:read"), false],
  ["viewer dashboard:read", canAccess(viewer, "dashboard:read"), true],
  ["qa quality:approve", canAccess(qa, "quality:approve"), true],
  ["qa users:create", canAccess(qa, "users:create"), false],
  ["inactive viewer dashboard", canAccess(inactive, "dashboard:read"), false],
  ["viewer print", hasPermission(viewer.permissions, "dashboard:print"), false],
  ["admin masters:create", canAccess(admin, "masters:create"), true],
  ["viewer masters:read", canAccess(viewer, "masters:read"), false],
  ["admin products:create", canAccess(admin, "products:create"), true],
  ["viewer products:read", canAccess(viewer, "products:read"), false],
  ["qa materials:approve", canAccess(qa, "materials:approve"), true],
] as const;

let failed = 0;
for (const [name, actual, expected] of cases) {
  const ok = actual === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${String(actual)} expected ${String(expected)}`);
}

if (failed) {
  process.exit(1);
}
