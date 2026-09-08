import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function pvFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const idToken = await token();
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "x-firebase-id-token": idToken, ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok) throw new Error(body.error || publicMasterError(new Error("Request failed.")));
  return body;
}

export function pvQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listPv(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return pvFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/pv/${resource}${pvQuery(params)}`
  );
}

export function getPv(resource: string, id: string) {
  return pvFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(`/api/pv/${resource}/${id}`);
}

export function createPv(resource: string, payload: Record<string, unknown>) {
  return pvFetch<{ id: string; record: Record<string, unknown>; extra?: unknown }>(
    `/api/pv/${resource}`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export function runPvAction(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  return pvFetch<{ id: string; record: Record<string, unknown>; extra?: unknown }>(
    `/api/pv/${resource}/${id}/action`,
    { method: "POST", body: JSON.stringify({ ...payload, action }) }
  );
}

export function getPvDashboard() {
  return pvFetch<{ stats: Record<string, unknown> }>("/api/pv/dashboard");
}

export function getPvReport(type: string, params: Record<string, string | undefined> = {}) {
  return pvFetch<{ rows: Array<Record<string, unknown>>; nextCursor: string | null }>(`/api/pv/reports${pvQuery({ ...params, type })}`);
}

export function getPvDuplicates(params: Record<string, string | undefined>) {
  return pvFetch<{ rows: Array<Record<string, unknown>> }>(`/api/pv/duplicates${pvQuery(params)}`);
}

export function getPvBatch(batchNumber: string) {
  return pvFetch<{ found: boolean; message?: string; batch?: Record<string, unknown> }>(`/api/pv/batch${pvQuery({ batchNumber })}`);
}

export function getProductSafety(productId: string) {
  return pvFetch<{ record: Record<string, unknown>; extra: Record<string, unknown> }>(`/api/pv/products/${productId}`);
}
