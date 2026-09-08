import { writeAuditLog } from "@/lib/auth/firestore-rest";
import { createNamedError } from "@/lib/masters/errors";
import {
  queryMasterDocuments,
  readMasterDocument,
  type AtomicWrite,
  type MasterRecord,
} from "@/lib/masters/firestore";
import { isUsableForNewTransactions } from "@/lib/masters/permissions";
import { ensureDocumentNumberSeries, nextDocumentNumber } from "@/lib/masters/numbering";
import { writeNotification, type NotificationInput } from "@/lib/notifications/service";
import { INVENTORY_NUMBER_SERIES } from "@/lib/inventory/collections";
import { parseForm } from "@/lib/validation/schemas";
import type { SessionPayload } from "@/types/auth";
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

export async function requireRecord(
  collection: string,
  id: string,
  idToken: string,
  label: string
) {
  const record = await readMasterDocument(collection, id, idToken);
  if (!record) fail(`${label} was not found.`);
  return record;
}

export async function requireActiveMaster(
  collection: string,
  id: string,
  idToken: string,
  label: string
) {
  const record = await requireRecord(collection, id, idToken, label);
  if (!isUsableForNewTransactions(record.status)) {
    fail(`${label} is not available for new warehouse transactions.`);
  }
  return record;
}

export async function issueWarehouseNumber(
  series: keyof typeof INVENTORY_NUMBER_SERIES,
  session: SessionPayload,
  idToken: string
) {
  const config = INVENTORY_NUMBER_SERIES[series];
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

export async function auditWarehouse(
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
    module: "warehouse",
    resource: event.resource,
    resourceId: event.resourceId,
    description: event.description,
    severity: event.severity || "info",
    oldData: event.oldData,
    newData: event.newData,
    reason: event.reason || "",
    createdAt: new Date().toISOString(),
  });
}

export async function notifyWarehouse(
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

export async function findByField(
  collection: string,
  field: string,
  value: string,
  idToken: string
) {
  const rows = await queryMasterDocuments(collection, idToken, {
    filters: [{ field, value }],
    limit: 20,
  });
  return rows;
}

export function asRecord(row: MasterRecord) {
  return row as MasterRecord;
}

export function text(value: unknown) {
  return String(value ?? "").trim();
}

export function yearNow() {
  return String(new Date().getFullYear());
}
