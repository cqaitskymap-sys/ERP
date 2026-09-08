import { env } from "@/lib/env";

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export type QueryOperator =
  | "EQUAL"
  | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN"
  | "GREATER_THAN"
  | "LESS_THAN_OR_EQUAL";

export interface MasterQueryFilter {
  field: string;
  op?: QueryOperator;
  value: string | number | boolean;
}

export interface MasterQueryOptions {
  filters?: MasterQueryFilter[];
  orderBy?: Array<{ field: string; direction?: "ASCENDING" | "DESCENDING" }>;
  startAfter?: Array<string | number | boolean>;
  limit?: number;
}

function documentsRoot() {
  return `https://firestore.googleapis.com/v1/projects/${env.firebase.projectId}/databases/(default)/documents`;
}

function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => encodeValue(item)) } };
  }
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          encodeValue(item),
        ])
      ),
    },
  };
}

function decodeValue(value: FirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields ?? {}).map(([key, item]) => [
        key,
        decodeValue(item),
      ])
    );
  }
  return undefined;
}

export function encodeFields(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, encodeValue(value)])
  );
}

export function decodeFields(fields?: Record<string, FirestoreValue>) {
  return Object.fromEntries(
    Object.entries(fields ?? {}).map(([key, value]) => [key, decodeValue(value)])
  ) as Record<string, unknown>;
}

export type MasterRecord = Record<string, unknown> & {
  id: string;
  _updateTime?: string;
};

export function sanitizeMasterRecord(data: Record<string, unknown>) {
  const next = { ...data };
  delete next.id;
  delete next._updateTime;
  return next;
}

async function firestoreJson(url: string, idToken: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; status?: string };
    fields?: Record<string, FirestoreValue>;
    updateTime?: string;
  };
  if (!response.ok) {
    const error = new Error(body.error?.message || `Firestore request failed (${response.status})`);
    error.name =
      response.status === 404
        ? "NotFoundError"
        : body.error?.status === "FAILED_PRECONDITION"
          ? "ConflictError"
          : "FirestoreError";
    throw error;
  }
  return body;
}

export async function readMasterDocument(
  collection: string,
  id: string,
  idToken: string
): Promise<MasterRecord | null> {
  try {
    const doc = await firestoreJson(`${documentsRoot()}/${collection}/${id}`, idToken);
    return {
      id,
      ...decodeFields(doc.fields),
      _updateTime: doc.updateTime,
    } as MasterRecord;
  } catch (error) {
    if (error instanceof Error && error.name === "NotFoundError") return null;
    throw error;
  }
}

export interface AtomicWrite {
  collection: string;
  id: string;
  data: Record<string, unknown>;
  updateTime?: string;
  exists?: boolean;
}

export async function commitMasterDocuments(writes: AtomicWrite[], idToken: string) {
  if (!writes.length) return;
  const base = `https://firestore.googleapis.com/v1/projects/${env.firebase.projectId}/databases/(default)`;
  const payload = {
    writes: writes.map((write) => {
      const entry: Record<string, unknown> = {
        update: {
          name: `projects/${env.firebase.projectId}/databases/(default)/documents/${write.collection}/${write.id}`,
          fields: encodeFields(sanitizeMasterRecord(write.data)),
        },
      };
      if (write.updateTime) {
        entry.currentDocument = { updateTime: write.updateTime };
      } else if (write.exists === false) {
        entry.currentDocument = { exists: false };
      } else if (write.exists === true) {
        entry.currentDocument = { exists: true };
      }
      return entry;
    }),
  };

  const response = await fetch(`${base}/documents:commit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string; status?: string };
  };
  if (!response.ok) {
    const error = new Error(body.error?.message || `Firestore commit failed (${response.status})`);
    error.name =
      body.error?.status === "FAILED_PRECONDITION" || response.status === 409
        ? "ConflictError"
        : /permission|insufficient|PERMISSION_DENIED/i.test(body.error?.message || "")
          ? "ForbiddenError"
          : "FirestoreError";
    throw error;
  }
}

export async function writeMasterDocument(
  collection: string,
  id: string,
  data: Record<string, unknown>,
  idToken: string,
  updateTime?: string
) {
  const payload = { fields: encodeFields(sanitizeMasterRecord(data)) };
  const params = new URLSearchParams();
  if (updateTime) params.set("currentDocument.updateTime", updateTime);

  try {
    await firestoreJson(
      `${documentsRoot()}/${collection}/${id}?${params.toString()}`,
      idToken,
      { method: "PATCH", body: JSON.stringify(payload) }
    );
  } catch (error) {
    if (error instanceof Error && error.name === "ConflictError") throw error;
    await firestoreJson(
      `${documentsRoot()}/${collection}?documentId=${id}`,
      idToken,
      { method: "POST", body: JSON.stringify(payload) }
    );
  }
}

function toFieldFilter(filter: MasterQueryFilter) {
  return {
    fieldFilter: {
      field: { fieldPath: filter.field },
      op: filter.op ?? "EQUAL",
      value: encodeValue(filter.value),
    },
  };
}

export async function queryMasterDocuments(
  collectionName: string,
  idToken: string,
  options: MasterQueryOptions = {}
): Promise<MasterRecord[]> {
  const filters = options.filters ?? [];
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: collectionName }],
    limit: options.limit ?? 20,
  };

  if (filters.length === 1) {
    structuredQuery.where = toFieldFilter(filters[0]);
  } else if (filters.length > 1) {
    structuredQuery.where = {
      compositeFilter: {
        op: "AND",
        filters: filters.map(toFieldFilter),
      },
    };
  }

  if (options.orderBy?.length) {
    structuredQuery.orderBy = options.orderBy.map((item) => ({
      field: { fieldPath: item.field },
      direction: item.direction ?? "ASCENDING",
    }));
  }

  if (options.startAfter?.length) {
    structuredQuery.startAt = {
      values: options.startAfter.map((value) => encodeValue(value)),
      before: false,
    };
  }

  const response = await fetch(`${documentsRoot()}:runQuery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ structuredQuery }),
  });
  const payload = (await response.json()) as
    | Array<{
        document?: {
          name?: string;
          fields?: Record<string, FirestoreValue>;
          updateTime?: string;
        };
        error?: { message?: string };
      }>
    | { error?: { message?: string; status?: string } };

  if (!response.ok) {
    const message = Array.isArray(payload)
      ? payload[0]?.error?.message
      : payload.error?.message;
    const error = new Error(message || "Firestore query failed.");
    error.name =
      /permission|insufficient|PERMISSION_DENIED/i.test(message || "")
        ? "ForbiddenError"
        : "FirestoreError";
    throw error;
  }

  const rows = Array.isArray(payload) ? payload : [];
  const queryError = rows[0]?.error?.message;
  if (queryError && !rows[0]?.document) {
    const error = new Error(queryError);
    error.name =
      /permission|insufficient|PERMISSION_DENIED/i.test(queryError)
        ? "ForbiddenError"
        : "FirestoreError";
    throw error;
  }

  return rows
    .filter((row) => row.document?.name)
    .map((row) => {
      const id = row.document?.name?.split("/").pop() || "";
      return {
        id,
        ...decodeFields(row.document?.fields),
        _updateTime: row.document?.updateTime,
      } as MasterRecord;
    });
}
