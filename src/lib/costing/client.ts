import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function costingFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export function costingQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listCosting(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return costingFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/costing/${resource}${costingQuery(params)}`
  );
}

export function getCosting(resource: string, id: string) {
  return costingFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(
    `/api/costing/${resource}/${id}`
  );
}

export function createCosting(resource: string, payload: Record<string, unknown>) {
  return costingFetch<{ id: string; record: Record<string, unknown> }>(`/api/costing/${resource}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runCostingAction(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  return costingFetch<{ id: string; record: Record<string, unknown> }>(`/api/costing/${resource}/${id}/action`, {
    method: "POST",
    body: JSON.stringify({ ...payload, action }),
  });
}

export function getCostingDashboard(params: Record<string, string | undefined> = {}) {
  return costingFetch<{ stats: Record<string, unknown> }>(`/api/costing/dashboard${costingQuery(params)}`);
}

export function getPendingCostingApprovals() {
  return costingFetch<{ rows: Array<Record<string, unknown> & { id: string }> }>("/api/costing/approvals");
}

export function getCostingReport(type: string, params: Record<string, string | undefined> = {}) {
  return costingFetch<{
    rows: Array<Record<string, unknown>>;
    nextCursor: string | null;
    meta?: Record<string, unknown>;
  }>(`/api/costing/reports${costingQuery({ ...params, type })}`);
}
