import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function qaFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const idToken = await token();
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "x-firebase-id-token": idToken, ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok) throw new Error(body.error || publicMasterError(new Error("Request failed.")));
  return body;
}

export function qaQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listQa(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return qaFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/qa/${resource}${qaQuery(params)}`
  );
}

export function getQa(resource: string, id: string) {
  return qaFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(`/api/qa/${resource}/${id}`);
}

export function createQa(resource: string, payload: Record<string, unknown>) {
  return qaFetch<{ id: string; record: Record<string, unknown>; extra?: unknown; items?: unknown; decision?: unknown }>(
    `/api/qa/${resource}`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export function runQaAction(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  return qaFetch<{ id: string; record: Record<string, unknown>; extra?: unknown; decision?: unknown }>(
    `/api/qa/${resource}/${id}/action`,
    { method: "POST", body: JSON.stringify({ ...payload, action }) }
  );
}

export function getQaDashboard() {
  return qaFetch<{ stats: Record<string, unknown> }>("/api/qa/dashboard");
}

export function getQaReport(type: string, params: Record<string, string | undefined> = {}) {
  return qaFetch<{ rows: Array<Record<string, unknown>>; nextCursor: string | null }>(`/api/qa/reports${qaQuery({ ...params, type })}`);
}
