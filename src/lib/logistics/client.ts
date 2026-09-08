import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function logisticsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const idToken = await token();
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "x-firebase-id-token": idToken, ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok) throw new Error(body.error || publicMasterError(new Error("Request failed.")));
  return body;
}

export function logisticsQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listLogistics(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return logisticsFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/logistics/${resource}${logisticsQuery(params)}`
  );
}

export function getLogistics(resource: string, id: string) {
  return logisticsFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(`/api/logistics/${resource}/${id}`);
}

export function createLogistics(resource: string, payload: Record<string, unknown>) {
  return logisticsFetch<{ id: string; record: Record<string, unknown> }>(`/api/logistics/${resource}`, { method: "POST", body: JSON.stringify(payload) });
}

export function runLogisticsAction(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  return logisticsFetch<{ id: string; record: Record<string, unknown> }>(
    `/api/logistics/${resource}/${id}/action`,
    { method: "POST", body: JSON.stringify({ ...payload, action }) }
  );
}

export function getLogisticsDashboard() {
  return logisticsFetch<{ stats: Record<string, unknown> }>("/api/logistics/dashboard");
}

export function getLogisticsReport(type: string, params: Record<string, string | undefined> = {}) {
  return logisticsFetch<{ rows: Array<Record<string, unknown>>; nextCursor: string | null }>(`/api/logistics/reports${logisticsQuery({ ...params, type })}`);
}

export function getWarehouse360(id: string) {
  return logisticsFetch<{ record: Record<string, unknown>; extra?: Record<string, unknown> }>(`/api/logistics/sites/${id}`);
}

export function getCustomerDistribution(id: string) {
  return logisticsFetch<{ record: Record<string, unknown>; extra?: Record<string, unknown> }>(`/api/logistics/customers/${id}`);
}

export function getRecallDistribution(batchNumber: string) {
  return logisticsFetch<{ record: Record<string, unknown>; extra?: Record<string, unknown> }>(`/api/logistics/recall${logisticsQuery({ batchNumber })}`);
}
