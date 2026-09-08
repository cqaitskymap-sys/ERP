import type { AppRole, Permission } from "@/types/permissions";

export type AccountStatus = "active" | "inactive" | "invited" | "suspended";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

export interface UserProfile {
  uid: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  designation: string | null;
  role: AppRole;
  roles: AppRole[];
  status: AccountStatus;
  photoURL: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  updatedAt?: string;
  permissions: Permission[];
  facilityId?: string | null;
}

export interface SessionPayload {
  uid: string;
  email: string;
  employeeId: string;
  name: string;
  role: AppRole;
  roles: AppRole[];
  permissions: Permission[];
  status: AccountStatus;
  remember: boolean;
}

export interface SignInPayload {
  email: string;
  password: string;
  remember?: boolean;
}

export interface SignUpPayload {
  email: string;
  password: string;
  name: string;
  employeeId?: string;
  phone?: string;
  department?: string;
  designation?: string;
}

export interface CreateUserPayload {
  email: string;
  name: string;
  employeeId?: string;
  phone?: string;
  department?: string;
  designation?: string;
  role: AppRole;
  status?: AccountStatus;
}
