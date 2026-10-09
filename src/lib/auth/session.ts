import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_REMEMBER,
  SESSION_MAX_AGE_TEMPORARY,
} from "@/lib/auth/constants";
import { resolvePermissions } from "@/lib/permissions/permission-service";
import type { SessionPayload } from "@/types/auth";

function secretKey() {
  return new TextEncoder().encode(env.sessionSecret);
}

function compactSession(payload: SessionPayload) {
  return {
    uid: payload.uid,
    email: payload.email,
    employeeId: payload.employeeId,
    name: payload.name,
    role: payload.role,
    roles: payload.roles,
    status: payload.status,
    remember: payload.remember,
  };
}

export function hydrateSession(payload: SessionPayload): SessionPayload {
  const role = payload.role;
  const roles = payload.roles?.length ? payload.roles : role ? [role] : [];
  return {
    ...payload,
    role: role || roles[0],
    roles,
    permissions: resolvePermissions(roles),
  };
}

export async function signSession(payload: SessionPayload) {
  const maxAge = payload.remember
    ? SESSION_MAX_AGE_REMEMBER
    : SESSION_MAX_AGE_TEMPORARY;

  return new SignJWT(compactSession(payload))
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, secretKey(), {
    algorithms: ["HS256"],
  });

  return hydrateSession(payload as unknown as SessionPayload);
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await signSession(payload);
  const jar = await cookies();
  const maxAge = payload.remember
    ? SESSION_MAX_AGE_REMEMBER
    : SESSION_MAX_AGE_TEMPORARY;

  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function readSessionCookie() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
