import { resolvePermissions } from "@/lib/permissions/permission-service";
import type { AppRole } from "@/types/permissions";
import type { AccountStatus, UserProfile } from "@/types/auth";

export function buildUserProfile(input: {
  uid: string;
  email: string;
  name: string;
  role: AppRole;
  employeeId?: string;
  phone?: string | null;
  department?: string | null;
  designation?: string | null;
  status?: AccountStatus;
  photoURL?: string | null;
}): UserProfile {
  const now = new Date().toISOString();
  return {
    uid: input.uid,
    employeeId: input.employeeId?.trim() || `EMP-${input.uid.slice(0, 6).toUpperCase()}`,
    name: input.name.trim(),
    email: input.email,
    phone: input.phone ?? null,
    department: input.department ?? null,
    designation: input.designation ?? null,
    role: input.role,
    roles: [input.role],
    status: input.status ?? "active",
    photoURL: input.photoURL ?? null,
    createdAt: now,
    lastLoginAt: null,
    updatedAt: now,
    permissions: resolvePermissions([input.role]),
  };
}

export function toSessionActor(profile: UserProfile) {
  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.name,
    photoURL: profile.photoURL,
    emailVerified: true,
  };
}
