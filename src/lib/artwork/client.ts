import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function artworkFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const idToken = await token();
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "x-firebase-id-token": idToken, ...init?.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok) throw new Error(body.error || publicMasterError(new Error("Request failed.")));
  return body;
}

export function artworkQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export type ArtworkRow = Record<string, unknown> & { id: string };

export function listArtwork(resource: string, params: Record<string, string | number | undefined | null> = {}) {
  return artworkFetch<{ rows: ArtworkRow[]; nextCursor: string | null }>(`/api/artwork/${resource}${artworkQuery(params)}`);
}

export function getArtwork(resource: string, id: string) {
  return artworkFetch<{ record: ArtworkRow; extra?: { approvals?: ArtworkRow[]; versions?: ArtworkRow[] } }>(
    `/api/artwork/${resource}/${id}`
  );
}

export function createArtwork(payload: Record<string, unknown>) {
  return artworkFetch<{ id: string; record: ArtworkRow }>("/api/artwork/requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function actOnArtwork(id: string, action: string, comment = "") {
  return artworkFetch<{ id: string; record: ArtworkRow }>(`/api/artwork/requests/${id}/action`, {
    method: "POST",
    body: JSON.stringify({ action, comment }),
  });
}

export function getArtworkDashboard() {
  return artworkFetch<{ kpis: Record<string, number>; queue: ArtworkRow[] }>("/api/artwork/dashboard");
}
