import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function sqFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const idToken = await token();
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "x-firebase-id-token": idToken, ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok) throw new Error(body.error || publicMasterError(new Error("Request failed.")));
  return body;
}

export function sqQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listSq(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return sqFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/sq/${resource}${sqQuery(params)}`
  );
}

export function getSq(resource: string, id: string) {
  return sqFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(`/api/sq/${resource}/${id}`);
}

export function createSq(resource: string, payload: Record<string, unknown>) {
  return sqFetch<{ id: string; record: Record<string, unknown> }>(`/api/sq/${resource}`, { method: "POST", body: JSON.stringify(payload) });
}

export function runSqAction(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  return sqFetch<{ id: string; record: Record<string, unknown> }>(
    `/api/sq/${resource}/${id}/action`,
    { method: "POST", body: JSON.stringify({ ...payload, action }) }
  );
}

export function getSqDashboard() {
  return sqFetch<{ stats: Record<string, unknown> }>("/api/sq/dashboard");
}

export function getSqReport(type: string, params: Record<string, string | undefined> = {}) {
  return sqFetch<{ rows: Array<Record<string, unknown>>; nextCursor: string | null }>(`/api/sq/reports${sqQuery({ ...params, type })}`);
}

export function getSqCalendar() {
  return sqFetch<{ record: Record<string, unknown>; extra: Record<string, unknown> }>("/api/sq/calendar");
}
