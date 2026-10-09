import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function engineeringFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export function engineeringQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listEngineering(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return engineeringFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/engineering/${resource}${engineeringQuery(params)}`
  );
}

export function getEngineering(resource: string, id: string) {
  return engineeringFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(
    `/api/engineering/${resource}/${id}`
  );
}

export function createEngineering(resource: string, payload: Record<string, unknown>) {
  return engineeringFetch<{ id: string; record: Record<string, unknown> }>(`/api/engineering/${resource}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runEngineeringAction(
  resource: string,
  id: string,
  action: string,
  payload: Record<string, unknown> = {}
) {
  return engineeringFetch<{ id: string; record: Record<string, unknown> }>(
    `/api/engineering/${resource}/${id}/action`,
    { method: "POST", body: JSON.stringify({ ...payload, action }) }
  );
}

export function getEngineeringDashboard(params: Record<string, string | undefined> = {}) {
  return engineeringFetch<{ stats: Record<string, unknown> }>(`/api/engineering/dashboard${engineeringQuery(params)}`);
}

export function getPendingEngineeringApprovals() {
  return engineeringFetch<{ rows: Array<Record<string, unknown> & { id: string }> }>("/api/engineering/approvals");
}

export function getEngineeringReport(type: string, params: Record<string, string | undefined> = {}) {
  return engineeringFetch<{
    rows: Array<Record<string, unknown>>;
    nextCursor: string | null;
    meta?: Record<string, unknown>;
  }>(`/api/engineering/reports${engineeringQuery({ ...params, type })}`);
}
