import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function financeFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export function financeQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listFinance(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return financeFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/finance/${resource}${financeQuery(params)}`
  );
}

export function getFinance(resource: string, id: string) {
  return financeFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(
    `/api/finance/${resource}/${id}`
  );
}

export function createFinance(resource: string, payload: Record<string, unknown>) {
  return financeFetch<{ id: string; record: Record<string, unknown>; items?: unknown[] }>(
    `/api/finance/${resource}`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export function runFinanceAction(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  return financeFetch<{ id: string; record: Record<string, unknown> }>(
    `/api/finance/${resource}/${id}/action`,
    { method: "POST", body: JSON.stringify({ ...payload, action }) }
  );
}

export function getFinanceDashboard(params: Record<string, string | undefined> = {}) {
  return financeFetch<{ stats: Record<string, unknown> }>(`/api/finance/dashboard${financeQuery(params)}`);
}

export function getPendingFinanceApprovals() {
  return financeFetch<{ rows: Array<Record<string, unknown> & { id: string }> }>("/api/finance/approvals");
}

export function getFinanceReport(type: string, params: Record<string, string | undefined> = {}) {
  return financeFetch<{
    rows: Array<Record<string, unknown>>;
    nextCursor: string | null;
    grouped?: Record<string, number>;
  }>(`/api/finance/reports${financeQuery({ ...params, type })}`);
}
