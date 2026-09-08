import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function qcFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const idToken = await token();
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "x-firebase-id-token": idToken, ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok) throw new Error(body.error || publicMasterError(new Error("Request failed.")));
  return body;
}

export function qcQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listQc(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return qcFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/qc/${resource}${qcQuery(params)}`
  );
}

export function getQc(resource: string, id: string) {
  return qcFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(`/api/qc/${resource}/${id}`);
}

export function createQc(resource: string, payload: Record<string, unknown>) {
  return qcFetch<{ id: string; record: Record<string, unknown>; extra?: unknown; test?: unknown; items?: unknown; results?: unknown }>(
    `/api/qc/${resource}`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export function runQcAction(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  return qcFetch<{ id: string; record: Record<string, unknown> }>(`/api/qc/${resource}/${id}/action`, {
    method: "POST",
    body: JSON.stringify({ ...payload, action }),
  });
}

export function getQcDashboard() {
  return qcFetch<{ stats: Record<string, unknown> }>("/api/qc/dashboard");
}

export function getQcReport(type: string, params: Record<string, string | undefined> = {}) {
  return qcFetch<{ rows: Array<Record<string, unknown>>; nextCursor: string | null }>(`/api/qc/reports${qcQuery({ ...params, type })}`);
}
