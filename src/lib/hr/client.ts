import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function hrFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export function hrQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listHr(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return hrFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/hr/${resource}${hrQuery(params)}`
  );
}

export function getHr(resource: string, id: string) {
  return hrFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(
    `/api/hr/${resource}/${id}`
  );
}

export function createHr(resource: string, payload: Record<string, unknown>) {
  return hrFetch<{ id: string; record: Record<string, unknown> }>(`/api/hr/${resource}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function runHrAction(
  resource: string,
  id: string,
  action: string,
  payload: Record<string, unknown> = {}
) {
  return hrFetch<{ id: string; record: Record<string, unknown> }>(`/api/hr/${resource}/${id}/action`, {
    method: "POST",
    body: JSON.stringify({ ...payload, action }),
  });
}

export function getHrDashboard(params: Record<string, string | undefined> = {}) {
  return hrFetch<{ stats: Record<string, unknown> }>(`/api/hr/dashboard${hrQuery(params)}`);
}

export function getPendingHrApprovals() {
  return hrFetch<{ rows: Array<Record<string, unknown> & { id: string }> }>("/api/hr/approvals");
}

export function getHrReport(type: string, params: Record<string, string | undefined> = {}) {
  return hrFetch<{
    rows: Array<Record<string, unknown>>;
    nextCursor: string | null;
    meta?: Record<string, unknown>;
  }>(`/api/hr/reports${hrQuery({ ...params, type })}`);
}
