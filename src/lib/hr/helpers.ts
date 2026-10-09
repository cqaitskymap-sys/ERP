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
import { HR_COLLECTIONS } from "@/lib/hr/collections";
import { HR_NUMBER_SERIES } from "@/lib/hr/config";
import { parseForm } from "@/lib/validation/schemas";
import { canAccess, canAccessAny, hasPermission } from "@/lib/permissions/permission-service";
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

export function ensureAnyPermission(session: SessionPayload, permissions: Permission[]) {
  if (!canAccessAny(session, permissions)) {
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

export async function issueHrNumber(
  series: keyof typeof HR_NUMBER_SERIES,
  session: SessionPayload,
  idToken: string
) {
  const config = HR_NUMBER_SERIES[series];
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

export async function auditHr(
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
    module: "hr",
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
        collection: HR_COLLECTIONS.audit,
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

export async function notifyHr(idToken: string, session: SessionPayload, input: NotificationInput) {
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
  return { collection, id, data, updateTime: options?.updateTime, exists: options?.exists };
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
  const existing = await readMasterDocument(HR_COLLECTIONS.idempotency, key, idToken);
  if (existing?.result && typeof existing.result === "object") {
    return existing.result as Record<string, unknown>;
  }
  return null;
}

export function idempotencyWrite(key: string, result: Record<string, unknown>, session: SessionPayload) {
  return writeOf(
    HR_COLLECTIONS.idempotency,
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

export function toUtcIso(value?: string | Date) {
  if (!value) return new Date().toISOString();
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) fail("Invalid timestamp.");
  return date.toISOString();
}

export function dateOnly(value?: string) {
  return text(value || new Date().toISOString()).slice(0, 10);
}

export function canViewPayroll(session: SessionPayload) {
  return (
    hasPermission(session.permissions, "hrPayroll:read") ||
    hasPermission(session.permissions, "hrPayroll:approve") ||
    hasPermission(session.permissions, "hr:read")
  );
}

export function canViewSensitiveEmployee(session: SessionPayload) {
  return (
    hasPermission(session.permissions, "hrEmployee:read") ||
    hasPermission(session.permissions, "hr:update") ||
    hasPermission(session.permissions, "hr:create")
  );
}

export function maskSensitiveEmployee(record: Record<string, unknown>, session: SessionPayload) {
  if (canViewSensitiveEmployee(session)) return record;
  const { emergencyContactName: _n, emergencyContactPhone: _p, ...rest } = record;
  return rest;
}

export function maskPayrollFields(record: Record<string, unknown>, session: SessionPayload) {
  if (canViewPayroll(session)) return record;
  const clone = { ...record };
  for (const key of [
    "basic",
    "hra",
    "otherAllowances",
    "grossEarnings",
    "employeeDeductions",
    "employerContributions",
    "netPayable",
    "employerTotalCost",
    "overtime",
    "bonuses",
  ]) {
    if (key in clone) clone[key] = "[restricted]";
  }
  return clone;
}
