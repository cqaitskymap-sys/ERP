import { writeAuditLog } from "@/lib/auth/firestore-rest";
import { createNamedError } from "@/lib/masters/errors";
import {
  commitMasterDocuments,
  queryMasterDocuments,
  readMasterDocument,
  type AtomicWrite,
  type MasterRecord,
} from "@/lib/masters/firestore";
import { ensureDocumentNumberSeries, nextDocumentNumber } from "@/lib/masters/numbering";
import { writeNotification, type NotificationInput } from "@/lib/notifications/service";
import { COSTING_COLLECTIONS } from "@/lib/costing/collections";
import { COSTING_NUMBER_SERIES } from "@/lib/costing/config";
import { parseForm } from "@/lib/validation/schemas";
import { canAccess, hasAnyPermission, hasRole } from "@/lib/permissions/permission-service";
import type { SessionPayload } from "@/types/auth";
import type { Permission } from "@/types/permissions";
import type { z } from "zod";

export function fail(message: string): never {
  throw createNamedError("ValidationError", message);
}

export function parseOrFail<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = parseForm(schema, payload);
  if (!parsed.data) {
    fail(Object.values(parsed.errors)[0] || "Please correct the highlighted fields.");
  }
  return parsed.data;
}

export function ensurePermission(session: SessionPayload, permission: Permission) {
  if (!canAccess(session, permission)) {
    fail("You do not have permission for this action.");
  }
}

export function workflowFail(current: string, action: string): never {
  fail(`Cannot ${action} a record in "${current}" status.`);
}

export async function requireRecord(collection: string, id: string, idToken: string, label: string) {
  const record = await readMasterDocument(collection, id, idToken);
  if (!record) fail(`${label} was not found.`);
  return record;
}

export async function issueCostingNumber(
  series: keyof typeof COSTING_NUMBER_SERIES,
  session: SessionPayload,
  idToken: string
) {
  const config = COSTING_NUMBER_SERIES[series];
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

export async function auditCosting(
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
    severity?: string;
  }
) {
  await writeAuditLog(idToken, {
    actorId: session.uid,
    actorEmail: session.email,
    action: event.action,
    module: "costing",
    resource: event.resource,
    resourceId: event.resourceId,
    description: event.description,
    severity: event.severity || "info",
    oldData: event.oldData || {},
    newData: event.newData || {},
    reason: event.reason || "",
    createdAt: new Date().toISOString(),
  });
  const auditId = crypto.randomUUID();
  await commitMasterDocuments(
    [
      {
        collection: COSTING_COLLECTIONS.audit,
        id: auditId,
        data: {
          auditId,
          ...event,
          actorId: session.uid,
          actorEmail: session.email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: session.uid,
          updatedBy: session.uid,
        },
        exists: false,
      },
    ],
    idToken
  );
}

export async function notifyCosting(
  idToken: string,
  session: SessionPayload,
  input: NotificationInput
) {
  await writeNotification(idToken, session, input);
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
  return {
    collection,
    id,
    data,
    updateTime: options?.updateTime,
    exists: options?.exists,
  };
}

export function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function commitWrites(writes: AtomicWrite[], idToken: string) {
  if (!writes.length) return;
  await commitMasterDocuments(writes, idToken);
}

export async function reuseIdempotent(key: string | undefined, idToken: string) {
  if (!key) return null;
  const existing = await readMasterDocument(COSTING_COLLECTIONS.idempotency, key, idToken);
  if (existing?.result && typeof existing.result === "object") {
    return existing.result as Record<string, unknown>;
  }
  return null;
}

export function idempotencyWrite(key: string, result: Record<string, unknown>, session: SessionPayload) {
  return writeOf(
    COSTING_COLLECTIONS.idempotency,
    key,
    {
      idempotencyKey: key,
      result,
      createdBy: session.uid,
      createdAt: new Date().toISOString(),
      updatedBy: session.uid,
      updatedAt: new Date().toISOString(),
    },
    { exists: false }
  );
}

export function canSeeCostMargins(session: SessionPayload) {
  return (
    hasAnyPermission(session.permissions, [
      "costing:read",
      "costingBatch:read",
      "costingReports:export",
      "finance:read",
    ]) || hasRole(session.roles, ["finance", "management", "admin", "super_admin"])
  );
}

export async function listByField(collection: string, field: string, value: string, idToken: string, limit = 100) {
  return queryMasterDocuments(collection, idToken, {
    filters: [{ field, value }],
    orderBy: [{ field: "updatedAt", direction: "DESCENDING" }],
    limit,
  });
}

export function asId(row: MasterRecord) {
  return String(row.id);
}

export function searchIndex(...parts: unknown[]) {
  return parts
    .map((part) => text(part).toLowerCase())
    .filter(Boolean)
    .join(" ");
}
