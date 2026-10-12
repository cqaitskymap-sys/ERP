import { writeAuditLog } from "@/lib/auth/firestore-rest";
import { createNamedError } from "@/lib/masters/errors";
import {
  commitMasterDocuments,
  queryMasterDocuments,
  readMasterDocument,
  type AtomicWrite,
} from "@/lib/masters/firestore";
import { ensureDocumentNumberSeries, nextDocumentNumber } from "@/lib/masters/numbering";
import { writeNotification, type NotificationInput } from "@/lib/notifications/service";
import { parseForm } from "@/lib/validation/schemas";
import { canAccess } from "@/lib/permissions/permission-service";
import { LOGISTICS_COLLECTIONS } from "@/lib/logistics/collections";
import { LOGISTICS_NUMBER_SERIES } from "@/lib/logistics/config";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";
import type { LogisticsSignature } from "@/types/logistics";
import type { z } from "zod";

export function fail(message: string): never {
  throw createNamedError("ValidationError", message);
}

export function parseOrFail<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = parseForm(schema, payload);
  if (!parsed.data) fail(Object.values(parsed.errors)[0] || "Please correct the highlighted fields.");
  return parsed.data;
}

export function ensurePermission(session: SessionPayload, permission: Permission) {
  if (!canAccess(session, permission)) fail("You do not have permission for this action.");
}

export function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function requireRecord(collection: string, id: string, idToken: string, label: string) {
  const record = await readMasterDocument(collection, id, idToken);
  if (!record) fail(`${label} was not found.`);
  return record;
}

export async function issueLogisticsNumber(
  series: keyof typeof LOGISTICS_NUMBER_SERIES,
  session: SessionPayload,
  idToken: string
) {
  const config = LOGISTICS_NUMBER_SERIES[series];
  const financialYear = String(new Date().getFullYear());
  await ensureDocumentNumberSeries({
    documentType: config.documentType,
    prefix: config.prefix,
    financialYear,
    session,
    idToken,
  });
  return nextDocumentNumber({
    documentType: config.documentType,
    financialYear,
    session,
    idToken,
  });
}

export function electronicSignature(session: SessionPayload, action: string, reason?: string): LogisticsSignature {
  return {
    signedBy: session.uid,
    signedByEmail: session.email,
    signedByRole: session.role,
    signedAt: new Date().toISOString(),
    action,
    reason: reason || "",
    signatureReference: crypto.randomUUID(),
  };
}

export function preventSelfApproval(session: SessionPayload, createdBy: unknown) {
  if (session.uid === text(createdBy) && !["admin", "super_admin"].includes(session.role)) {
    fail("Separation of duties: you cannot approve a record you created.");
  }
}

export async function auditLogistics(
  idToken: string,
  session: SessionPayload,
  event: {
    action: string;
    resource: string;
    resourceId: string;
    description: string;
    oldData?: Record<string, unknown>;
    newData?: Record<string, unknown>;
    reason?: string;
  }
) {
  await writeAuditLog(idToken, {
    actorId: session.uid,
    actorEmail: session.email,
    action: event.action,
    module: "warehouse_logistics",
    resource: event.resource,
    resourceId: event.resourceId,
    description: event.description,
    severity: "info",
    oldData: event.oldData || {},
    newData: event.newData || {},
    reason: event.reason || "",
    createdAt: new Date().toISOString(),
  });
}

export async function notifyLogistics(idToken: string, session: SessionPayload, input: NotificationInput) {
  await writeNotification(idToken, session, { ...input, module: input.module || "warehouse" });
}

export function actorStamp(session: SessionPayload, existing?: Record<string, unknown>) {
  const now = new Date().toISOString();
  return {
    createdBy: existing?.createdBy || session.uid,
    createdAt: existing?.createdAt || now,
    updatedBy: session.uid,
    updatedAt: now,
  };
}

export function writeOf(
  collection: string,
  id: string,
  data: Record<string, unknown>,
  options?: { updateTime?: string; exists?: boolean }
): AtomicWrite {
  return { collection, id, data, updateTime: options?.updateTime, exists: options?.exists };
}

export async function commitWrites(writes: AtomicWrite[], idToken: string) {
  if (!writes.length) return;
  await commitMasterDocuments(writes, idToken);
}

export async function reuseIdempotent(key: string | undefined, idToken: string) {
  if (!key) return null;
  const existing = await readMasterDocument(LOGISTICS_COLLECTIONS.idempotency, key, idToken);
  if (existing?.result && typeof existing.result === "object") {
    return existing.result as { id: string; record: Record<string, unknown> };
  }
  return null;
}

export function idempotencyWrite(key: string, result: Record<string, unknown>, session: SessionPayload) {
  return writeOf(LOGISTICS_COLLECTIONS.idempotency, key, { idempotencyKey: key, result, ...actorStamp(session) }, { exists: false });
}

export async function listByField(collection: string, field: string, value: string, idToken: string, limit = 100) {
  if (!value) return [];
  return queryMasterDocuments(collection, idToken, {
    filters: [{ field, value }],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit,
  });
}

export function canTransition(map: Record<string, string[]>, current: string, next: string) {
  return (map[current] ?? []).includes(next);
}
