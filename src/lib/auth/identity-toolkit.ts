import { env } from "@/lib/env";

const AUTH_BASE = "https://identitytoolkit.googleapis.com/v1/accounts";

async function identityRequest<T>(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${AUTH_BASE}:${path}?key=${env.firebase.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(data.error?.message || `Identity Toolkit ${path} failed.`);
  }
  return data;
}

export async function createIdentityUser(email: string, password: string) {
  return identityRequest<{
    localId: string;
    idToken: string;
    email: string;
  }>("signUp", {
    email,
    password,
    returnSecureToken: true,
  });
}

export async function signInIdentityUser(email: string, password: string) {
  return identityRequest<{
    localId: string;
    idToken: string;
    email: string;
  }>("signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });
}

export function generateTemporaryPassword() {
  return `Ath-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}!`;
}
