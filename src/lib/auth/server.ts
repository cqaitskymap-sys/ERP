import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/session";
import {
  assertPermission,
  assertRole,
  canAccess,
} from "@/lib/permissions/permission-service";
import type { AppRole, Permission } from "@/types/permissions";
import type { SessionPayload } from "@/types/auth";

export async function getServerSession() {
  return readSessionCookie();
}

export async function requireSession() {
  const session = await getServerSession();
  if (!session) {
    const error = new Error("Authentication required.");
    error.name = "UnauthorizedError";
    throw error;
  }
  if (session.status !== "active") {
    const error = new Error("Account is not active.");
    error.name = "ForbiddenError";
    throw error;
  }
  return session;
}

export async function requirePermission(permission?: Permission | Permission[]) {
  const session = await requireSession();
  assertPermission(session, permission);
  return session;
}

export async function requireRole(role?: AppRole | AppRole[]) {
  const session = await requireSession();
  assertRole(session, role);
  return session;
}

export function sessionCan(session: SessionPayload | null, permission?: Permission) {
  return canAccess(session, permission);
}

export function authErrorResponse(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const message =
    error instanceof Error ? error.message : "Authorization failed.";

  if (name === "UnauthorizedError") {
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
  if (name === "ForbiddenError") {
    return NextResponse.json({ ok: false, error: message }, { status: 403 });
  }
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export function toPublicProfile(session: SessionPayload) {
  return {
    uid: session.uid,
    employeeId: session.employeeId,
    name: session.name,
    email: session.email,
    role: session.role,
    roles: session.roles,
    permissions: session.permissions,
    status: session.status,
  };
}
