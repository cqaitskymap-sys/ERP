import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function productionFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const idToken = await token();
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "x-firebase-id-token": idToken, ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok) throw new Error(body.error || publicMasterError(new Error("Request failed.")));
  return body;
}

export function productionQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listProduction(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return productionFetch<{ rows: Array<Record<string, unknown> & { id: string }>; nextCursor: string | null }>(
    `/api/production/${resource}${productionQuery(params)}`
  );
}

export function getProduction(resource: string, id: string) {
  return productionFetch<{ record: Record<string, unknown> & { id: string }; extra?: Record<string, unknown> }>(
    `/api/production/${resource}/${id}`
  );
}

export function createProduction(resource: string, payload: Record<string, unknown>) {
  return productionFetch<{ id: string; record: Record<string, unknown>; items?: unknown[]; availability?: unknown }>(
    `/api/production/${resource}`,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

export function runProductionAction(resource: string, id: string, action: string, payload: Record<string, unknown> = {}) {
  return productionFetch<{ id: string; record: Record<string, unknown> }>(
    `/api/production/${resource}/${id}/action`,
    { method: "POST", body: JSON.stringify({ ...payload, action }) }
  );
}

export function getProductionDashboard() {
  return productionFetch<{ stats: Record<string, unknown> }>("/api/production/dashboard");
}

export function getMaterialPlan(manufacturingOrderId: string) {
  return productionFetch<{ result: Record<string, unknown> }>(`/api/production/materials${productionQuery({ manufacturingOrderId })}`);
}

export function getProductionReadiness(id: string) {
  return productionFetch<{ result: { ready: boolean; blockers: string[]; warnings: string[] } }>(
    `/api/production/readiness${productionQuery({ id })}`
  );
}

export function getProductionReport(type: string, params: Record<string, string | undefined> = {}) {
  return productionFetch<{ rows: Array<Record<string, unknown>>; nextCursor: string | null }>(
    `/api/production/reports${productionQuery({ ...params, type })}`
  );
}

export function actOnStep(stepId: string, action: "start" | "complete" | "skip" | "fail", remarks?: string) {
  return productionFetch<{ id: string; record: Record<string, unknown> }>("/api/production/steps/action", {
    method: "POST",
    body: JSON.stringify({ stepId, action, remarks }),
  });
}
