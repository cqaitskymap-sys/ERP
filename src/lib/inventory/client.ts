import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function warehouseFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
  if (!response.ok) {
    throw new Error(body.error || publicMasterError(new Error("Request failed.")));
  }
  return body;
}

export function warehouseQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listWarehouse(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return warehouseFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/warehouse/${resource}${warehouseQuery(params)}`
  );
}

export function getWarehouse(resource: string, id: string) {
  return warehouseFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(
    `/api/warehouse/${resource}/${id}`
  );
}

export function createWarehouse(resource: string, payload: Record<string, unknown>) {
  return warehouseFetch<{ id: string; record: Record<string, unknown>; items?: unknown[] }>(
    `/api/warehouse/${resource}`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export function runWarehouseAction(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  return warehouseFetch<{ id: string; record: Record<string, unknown> }>(
    `/api/warehouse/${resource}/${id}/action`,
    { method: "POST", body: JSON.stringify({ ...payload, action }) }
  );
}

export function getWarehouseDashboard() {
  return warehouseFetch<{ stats: Record<string, unknown> }>("/api/warehouse/dashboard");
}

export function getQuarantineDashboard() {
  return warehouseFetch<{ stats: Record<string, unknown> }>("/api/warehouse/quarantine");
}

export function getExpiryMonitor() {
  return warehouseFetch<{ stats: Record<string, unknown> }>("/api/warehouse/expiry");
}

export function getLowStock() {
  return warehouseFetch<{ rows: Array<Record<string, unknown>> }>("/api/warehouse/low-stock");
}

export function getStockCard(params: Record<string, string | undefined>) {
  return warehouseFetch<{ card: Record<string, unknown> }>(`/api/warehouse/stock-card${warehouseQuery(params)}`);
}

export function getTraceability(batchNumber: string) {
  return warehouseFetch<{ result: Record<string, unknown> }>(
    `/api/warehouse/traceability${warehouseQuery({ batchNumber })}`
  );
}

export function getFefo(params: Record<string, string | number | undefined>) {
  return warehouseFetch<{ selection: Record<string, unknown> }>(`/api/warehouse/fefo${warehouseQuery(params)}`);
}

export function getWarehouseReport(type: string, params: Record<string, string | undefined> = {}) {
  return warehouseFetch<{ rows: Array<Record<string, unknown>>; nextCursor: string | null }>(
    `/api/warehouse/reports${warehouseQuery({ ...params, type })}`
  );
}

export function transitionQuality(payload: Record<string, unknown>) {
  return warehouseFetch<{ id: string; record: Record<string, unknown> }>("/api/warehouse/quality", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function saveInventoryDocument(payload: Record<string, unknown>) {
  return warehouseFetch<{ id: string; record: Record<string, unknown> }>("/api/warehouse/documents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
