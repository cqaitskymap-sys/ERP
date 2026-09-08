import { NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/auth/server";
import { createNamedError, publicMasterError } from "@/lib/masters/errors";
import { getMasterDefinition, MASTER_ENTITIES } from "@/lib/masters/registry";
import type { MasterEntity } from "@/types/masters";

export function isMasterEntity(value: string): value is MasterEntity {
  return MASTER_ENTITIES.includes(value as MasterEntity);
}

export function requireMasterEntity(value: string) {
  if (!isMasterEntity(value) || !getMasterDefinition(value)) {
    throw createNamedError("ValidationError", "Unknown master.");
  }
  return value;
}

export function requireIdToken(request: Request, body?: { idToken?: string }) {
  const token = body?.idToken || request.headers.get("x-firebase-id-token");
  if (!token) {
    throw createNamedError(
      "UnauthorizedError",
      "A fresh sign-in token is required."
    );
  }
  return token;
}

export function masterErrorResponse(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  if (name === "UnauthorizedError" || name === "ForbiddenError") {
    return authErrorResponse(error);
  }
  const status = name === "DuplicateError" ? 409 : 400;
  return NextResponse.json(
    { ok: false, error: publicMasterError(error) },
    { status }
  );
}
