import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function dmsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const idToken = await token();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-firebase-id-token": idToken,
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok) throw new Error(body.error || publicMasterError(new Error("Request failed.")));
  return body;
}

export function dmsQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listDms(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return dmsFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/dms/${resource}${dmsQuery(params)}`
  );
}

export function getDms(resource: string, id: string) {
  return dmsFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(
    `/api/dms/${resource}/${id}`
  );
}

export function createDms(resource: string, payload: Record<string, unknown>) {
  return dmsFetch<{ id: string; record: Record<string, unknown> }>(`/api/dms/${resource}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runDmsAction(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  return dmsFetch<Record<string, unknown>>(`/api/dms/${resource}/${id}/action`, {
    method: "POST",
    body: JSON.stringify({ ...payload, action }),
  });
}

export function getDmsDashboard(params: Record<string, string | undefined> = {}) {
  return dmsFetch<{ stats: Record<string, unknown> }>(`/api/dms/dashboard${dmsQuery(params)}`);
}

export function getPendingDmsApprovals() {
  return dmsFetch<{ rows: Array<Record<string, unknown> & { id: string }> }>("/api/dms/approvals");
}

export function getDmsReport(type: string, params: Record<string, string | undefined> = {}) {
  return dmsFetch<{ rows: Array<Record<string, unknown>>; nextCursor: string | null; meta?: Record<string, unknown> }>(
    `/api/dms/reports${dmsQuery({ ...params, type })}`
  );
}

export function prepareDmsFile(payload: Record<string, unknown>) {
  return dmsFetch<{ storagePath: string; maxBytes: number; versionId: string }>("/api/dms/files", {
    method: "POST",
    body: JSON.stringify({ ...payload, intent: "prepare" }),
  });
}

export function confirmDmsFile(payload: Record<string, unknown>) {
  return dmsFetch<{ id: string; record: Record<string, unknown> }>("/api/dms/files", {
    method: "POST",
    body: JSON.stringify({ ...payload, intent: "confirm" }),
  });
}
