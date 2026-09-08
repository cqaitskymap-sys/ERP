import { env } from "@/lib/env";
import { SYSTEM_COLLECTION, SYSTEM_CONFIG_ID, USERS_COLLECTION } from "@/lib/auth/constants";
import { resolvePermissions } from "@/lib/permissions/permission-service";
import { APP_ROLES } from "@/types/permissions";
import type { AppRole } from "@/types/permissions";
import type { AccountStatus, UserProfile } from "@/types/auth";

function documentsUrl(path: string) {
  return `https://firestore.googleapis.com/v1/projects/${env.firebase.projectId}/databases/(default)/documents/${path}`;
}

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "number") return { integerValue: String(value) };
  if (typeof value === "boolean") return { booleanValue: value };
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((item) => encodeValue(item)),
      },
    };
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
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) {
    return (value.arrayValue.values ?? []).map((item) => decodeValue(item));
  }
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

function encodeDocument(data: Record<string, unknown>) {
  return {
    fields: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, encodeValue(value)])
    ),
  };
}

function decodeDocument(fields?: Record<string, FirestoreValue>) {
  return Object.fromEntries(
    Object.entries(fields ?? {}).map(([key, value]) => [key, decodeValue(value)])
  );
}

async function firestoreRequest(
  url: string,
  idToken: string | null,
  init?: RequestInit
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const response = await fetch(url, { ...init, headers: { ...headers, ...init?.headers } });
  const body = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    fields?: Record<string, FirestoreValue>;
    documents?: Array<{ name?: string; fields?: Record<string, FirestoreValue> }>;
  };

  if (!response.ok) {
    const error = new Error(body.error?.message || `Firestore request failed (${response.status})`);
    error.name = response.status === 404 ? "NotFoundError" : "FirestoreError";
    throw error;
  }

  return body;
}

export function normalizeUserProfile(
  uid: string,
  data: Record<string, unknown>
): UserProfile {
  const rawRole = String(data.role || (data.roles as string[] | undefined)?.[0] || "viewer");
  const role = (APP_ROLES as readonly string[]).includes(rawRole)
    ? (rawRole as AppRole)
    : "viewer";
  const roles = Array.isArray(data.roles)
    ? (data.roles.filter((item): item is AppRole =>
        (APP_ROLES as readonly string[]).includes(String(item))
      ) as AppRole[])
    : [role];
  const uniqueRoles = Array.from(new Set(roles.length ? roles : [role]));
  const status = (["active", "inactive", "invited", "suspended"] as AccountStatus[]).includes(
    data.status as AccountStatus
  )
    ? (data.status as AccountStatus)
    : "inactive";

  return {
    uid,
    employeeId: String(data.employeeId || `EMP-${uid.slice(0, 6).toUpperCase()}`),
    name: String(data.name || data.displayName || data.email || "Operator"),
    email: String(data.email || ""),
    phone: (data.phone as string | null) ?? null,
    department: (data.department as string | null) ?? null,
    designation: (data.designation as string | null) ?? null,
    role,
    roles: uniqueRoles,
    status,
    photoURL: (data.photoURL as string | null) ?? null,
    createdAt: String(data.createdAt || new Date().toISOString()),
    lastLoginAt: (data.lastLoginAt as string | null) ?? null,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    permissions: resolvePermissions(uniqueRoles),
    facilityId: (data.facilityId as string | null) ?? null,
  };
}

export async function readUserProfile(uid: string, idToken: string) {
  try {
    const doc = await firestoreRequest(
      documentsUrl(`${USERS_COLLECTION}/${uid}`),
      idToken
    );
    return normalizeUserProfile(uid, decodeDocument(doc.fields));
  } catch (error) {
    if (error instanceof Error && error.name === "NotFoundError") return null;
    throw error;
  }
}

export async function writeUserProfile(
  profile: UserProfile,
  idToken: string
) {
  const payload = encodeDocument({
    ...profile,
    updatedAt: new Date().toISOString(),
  });

  try {
    await firestoreRequest(
      documentsUrl(`${USERS_COLLECTION}/${profile.uid}`),
      idToken,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );
  } catch {
    await firestoreRequest(
      `${documentsUrl(USERS_COLLECTION)}?documentId=${profile.uid}`,
      idToken,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }
}

export async function createUserProfile(profile: UserProfile, idToken: string) {
  await writeUserProfile(profile, idToken);
}

export async function listUserProfiles(idToken: string) {
  const result = await firestoreRequest(documentsUrl(USERS_COLLECTION), idToken);
  return (result.documents ?? []).map((document) => {
    const uid = document.name?.split("/").pop() || "";
    return normalizeUserProfile(uid, decodeDocument(document.fields));
  });
}

export async function readSystemConfig() {
  try {
    const doc = await firestoreRequest(
      documentsUrl(`${SYSTEM_COLLECTION}/${SYSTEM_CONFIG_ID}`),
      null
    );
    return decodeDocument(doc.fields) as { bootstrapped?: boolean };
  } catch (error) {
    if (error instanceof Error && error.name === "NotFoundError") {
      return { bootstrapped: false };
    }
    return { bootstrapped: false };
  }
}

export async function writeSystemConfig(idToken: string) {
  const payload = encodeDocument({
    bootstrapped: true,
    bootstrappedAt: new Date().toISOString(),
  });

  try {
    await firestoreRequest(
      documentsUrl(`${SYSTEM_COLLECTION}/${SYSTEM_CONFIG_ID}`),
      idToken,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );
  } catch {
    await firestoreRequest(
      `${documentsUrl(SYSTEM_COLLECTION)}?documentId=${SYSTEM_CONFIG_ID}`,
      idToken,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }
}

export async function writeAuditLog(
  idToken: string,
  event: Record<string, unknown>
) {
  await firestoreRequest(
    documentsUrl("audit_logs"),
    idToken,
    {
      method: "POST",
      body: JSON.stringify(encodeDocument(event)),
    }
  ).catch((error) => {
    console.warn("Server audit write skipped:", error);
  });
}
