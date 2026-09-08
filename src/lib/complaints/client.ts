import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function complaintFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const idToken = await token();
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "x-firebase-id-token": idToken, ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok) throw new Error(body.error || publicMasterError(new Error("Request failed.")));
  return body;
}

export function complaintQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listComplaints(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return complaintFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/complaints/${resource}${complaintQuery(params)}`
  );
}

export function getComplaint(resource: string, id: string) {
  return complaintFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(`/api/complaints/${resource}/${id}`);
}

export function createComplaintRecord(resource: string, payload: Record<string, unknown>) {
  return complaintFetch<{ id: string; record: Record<string, unknown>; extra?: unknown }>(
    `/api/complaints/${resource}`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export function runComplaintAction(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  return complaintFetch<{ id: string; record: Record<string, unknown>; extra?: unknown }>(
    `/api/complaints/${resource}/${id}/action`,
    { method: "POST", body: JSON.stringify({ ...payload, action }) }
  );
}

export function getComplaintDashboard() {
  return complaintFetch<{ stats: Record<string, unknown> }>("/api/complaints/dashboard");
}

export function getComplaintReport(type: string, params: Record<string, string | undefined> = {}) {
  return complaintFetch<{ rows: Array<Record<string, unknown>>; nextCursor: string | null }>(`/api/complaints/reports${complaintQuery({ ...params, type })}`);
}

export function getRelatedComplaints(params: Record<string, string | undefined>) {
  return complaintFetch<{ rows: Array<Record<string, unknown>> }>(`/api/complaints/related${complaintQuery(params)}`);
}

export function getComplaintBatch(batchNumber: string) {
  return complaintFetch<{ found: boolean; message?: string; batch?: Record<string, unknown> }>(`/api/complaints/batch${complaintQuery({ batchNumber })}`);
}

export function getProductComplaintProfile(productId: string) {
  return complaintFetch<{ record: Record<string, unknown>; extra: Record<string, unknown> }>(`/api/complaints/products/${productId}`);
}

export function getCustomerComplaintProfile(customerId: string) {
  return complaintFetch<{ record: Record<string, unknown>; extra: Record<string, unknown> }>(`/api/complaints/customers/${customerId}`);
}

export function getBatchComplaintView(batchNumber: string) {
  return complaintFetch<{ record: Record<string, unknown>; extra: Record<string, unknown> }>(`/api/complaints/batches/${encodeURIComponent(batchNumber)}`);
}

export function getComplaintTrends() {
  return complaintFetch<{ record: Record<string, unknown>; extra: Record<string, unknown> }>("/api/complaints/trends");
}
