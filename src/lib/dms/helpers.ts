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
import { DMS_COLLECTIONS } from "@/lib/dms/collections";
import { DMS_NUMBER_SERIES } from "@/lib/dms/config";
import { signatureEmailMatches } from "@/lib/dms/lifecycle";
import { parseForm } from "@/lib/validation/schemas";
import { canAccess } from "@/lib/permissions/permission-service";
import type { SessionPayload } from "@/types/auth";
import type { DmsSignature } from "@/types/dms";
import type { Permission } from "@/types/permissions";
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

export async function issueDmsNumber(
  series: { documentType: string; prefix: string },
  session: SessionPayload,
  idToken: string
) {
  const financialYear = String(new Date().getFullYear());
  await ensureDocumentNumberSeries({
    documentType: series.documentType,
    prefix: series.prefix,
    financialYear,
    session,
    idToken,
  });
  return nextDocumentNumber({
    documentType: series.documentType,
    financialYear,
    session,
    idToken,
  });
}

export async function issueSeriesNumber(
  series: keyof typeof DMS_NUMBER_SERIES,
  session: SessionPayload,
  idToken: string
) {
  return issueDmsNumber(DMS_NUMBER_SERIES[series], session, idToken);
}

export function electronicSignature(
  session: SessionPayload,
  input: {
    meaning: string;
    reason?: string;
    documentNumber: string;
    versionLabel: string;
    stage: string;
  }
): DmsSignature {
  return {
    signedBy: session.uid,
    signedByEmail: session.email,
    signedByRole: session.role,
    signedAt: new Date().toISOString(),
    meaning: input.meaning,
    reason: input.reason || "",
    documentNumber: input.documentNumber,
    versionLabel: input.versionLabel,
    stage: input.stage,
    signatureReference: crypto.randomUUID(),
  };
}

export function assertSignature(session: SessionPayload, payload: Record<string, unknown>, required: boolean) {
  if (!required) return;
  const confirmed = text(payload.signatureEmail);
  if (!signatureEmailMatches(session.email, confirmed)) {
    fail(
      "Re-enter the email address of your authenticated account to confirm this electronic signature. A typed name or button click is not a signature."
    );
  }
  if (text(payload.reason || payload.comment).length < 3) {
    fail("A reason is required for this electronic signature.");
  }
}

export async function auditDms(
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
    module: "dms",
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
  try {
    await commitMasterDocuments(
      [
        {
          collection: DMS_COLLECTIONS.audit,
          id: auditId,
          data: {
            auditId,
            action: event.action,
            resource: event.resource,
            resourceId: event.resourceId,
            description: event.description,
            reason: event.reason || "",
            oldData: event.oldData || {},
            newData: event.newData || {},
            actorId: session.uid,
            actorEmail: session.email,
            severity: event.severity || "info",
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
  } catch (error) {
    console.warn("DMS module audit copy skipped:", error);
  }
}

export async function notifyDms(idToken: string, session: SessionPayload, input: NotificationInput) {
  await writeNotification(idToken, session, { ...input, module: input.module || "dms" });
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
  const existing = await readMasterDocument(DMS_COLLECTIONS.idempotency, key, idToken);
  if (existing?.result && typeof existing.result === "object") {
    return existing.result as Record<string, unknown>;
  }
  return null;
}

export function idempotencyWrite(key: string, result: Record<string, unknown>, session: SessionPayload) {
  return writeOf(
    DMS_COLLECTIONS.idempotency,
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

export function searchIndex(...parts: unknown[]) {
  return parts
    .map((part) => text(part).toLowerCase())
    .filter(Boolean)
    .join(" ");
}

export function asRecord(row: MasterRecord) {
  return row;
}

export function splitList(value: unknown) {
  return text(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}
