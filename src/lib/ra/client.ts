import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function raFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const idToken = await token();
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "x-firebase-id-token": idToken, ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok) throw new Error(body.error || publicMasterError(new Error("Request failed.")));
  return body;
}

export function raQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listRa(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return raFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/ra/${resource}${raQuery(params)}`
  );
}

export function getRa(resource: string, id: string) {
  return raFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(`/api/ra/${resource}/${id}`);
}

export function createRa(resource: string, payload: Record<string, unknown>) {
  return raFetch<{ id: string; record: Record<string, unknown>; extra?: unknown }>(
    `/api/ra/${resource}`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export function runRaAction(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  return raFetch<{ id: string; record: Record<string, unknown>; extra?: unknown }>(
    `/api/ra/${resource}/${id}/action`,
    { method: "POST", body: JSON.stringify({ ...payload, action }) }
  );
}

export function getRaDashboard() {
  return raFetch<{ stats: Record<string, unknown> }>("/api/ra/dashboard");
}

export function getRaCalendar() {
  return raFetch<{ events: Array<Record<string, unknown>> }>("/api/ra/calendar");
}

export function getRaReport(type: string, params: Record<string, string | undefined> = {}) {
  return raFetch<{ rows: Array<Record<string, unknown>>; nextCursor: string | null }>(`/api/ra/reports${raQuery({ ...params, type })}`);
}
