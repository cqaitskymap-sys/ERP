import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function salesFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export function salesQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listSales(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return salesFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/sales/${resource}${salesQuery(params)}`
  );
}

export function getSales(resource: string, id: string) {
  return salesFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(
    `/api/sales/${resource}/${id}`
  );
}

export function createSales(resource: string, payload: Record<string, unknown>) {
  return salesFetch<{ id: string; record: Record<string, unknown>; items?: unknown[] }>(
    `/api/sales/${resource}`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export function runSalesAction(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  return salesFetch<{ id: string; record: Record<string, unknown> }>(
    `/api/sales/${resource}/${id}/action`,
    { method: "POST", body: JSON.stringify({ ...payload, action }) }
  );
}

export function getSalesDashboard(params: Record<string, string | undefined> = {}) {
  return salesFetch<{ stats: Record<string, unknown> }>(`/api/sales/dashboard${salesQuery(params)}`);
}

export function getPendingSalesApprovals() {
  return salesFetch<{ rows: Array<Record<string, unknown> & { id: string }> }>("/api/sales/approvals");
}

export function getSalesReport(type: string, params: Record<string, string | undefined> = {}) {
  return salesFetch<{
    rows: Array<Record<string, unknown>>;
    nextCursor: string | null;
    grouped?: Record<string, number>;
  }>(`/api/sales/reports${salesQuery({ ...params, type })}`);
}

export function getCustomer360(customerId: string) {
  return salesFetch<{ result: Record<string, unknown> }>(`/api/sales/customers/${customerId}`);
}
