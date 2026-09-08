import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function procurementFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export function procurementQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listProcurement(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return procurementFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/procurement/${resource}${procurementQuery(params)}`
  );
}

export function getProcurement(resource: string, id: string) {
  return procurementFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(
    `/api/procurement/${resource}/${id}`
  );
}

export function createProcurement(resource: string, payload: Record<string, unknown>) {
  return procurementFetch<{ id: string; record: Record<string, unknown>; items?: unknown[] }>(
    `/api/procurement/${resource}`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export function runProcurementAction(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  return procurementFetch<{ id: string; record: Record<string, unknown> }>(
    `/api/procurement/${resource}/${id}/action`,
    { method: "POST", body: JSON.stringify({ ...payload, action }) }
  );
}

export function getProcurementDashboard() {
  return procurementFetch<{ stats: Record<string, unknown> }>("/api/procurement/dashboard");
}

export function getQuotationComparison(rfqId: string) {
  return procurementFetch<{ result: Record<string, unknown> }>(
    `/api/procurement/compare${procurementQuery({ rfqId })}`
  );
}

export function getPurchaseTracking(id: string) {
  return procurementFetch<{ result: Record<string, unknown> }>(`/api/procurement/tracking/${id}`);
}

export function getPendingApprovals() {
  return procurementFetch<{ rows: Array<Record<string, unknown> & { id: string }> }>("/api/procurement/approvals");
}

export function getOverduePurchaseOrders() {
  return procurementFetch<{ rows: Array<Record<string, unknown>> }>("/api/procurement/overdue");
}

export function getProcurementReport(type: string, params: Record<string, string | undefined> = {}) {
  return procurementFetch<{ rows: Array<Record<string, unknown>>; nextCursor: string | null; grouped?: Record<string, number> }>(
    `/api/procurement/reports${procurementQuery({ ...params, type })}`
  );
}

export function checkEligibility(kind: "vendor" | "material", payload: Record<string, string>) {
  return procurementFetch<{ result: { eligible: boolean; reasons: string[]; warnings: string[] } }>(
    "/api/procurement/eligibility",
    { method: "POST", body: JSON.stringify({ kind, ...payload }) }
  );
}

export function saveProcurementDocument(payload: Record<string, unknown>) {
  return procurementFetch<{ id: string; record: Record<string, unknown> }>("/api/procurement/documents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
