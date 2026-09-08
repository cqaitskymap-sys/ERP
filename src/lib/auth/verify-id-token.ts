import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@/lib/env";

const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

export interface VerifiedFirebaseUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export async function verifyFirebaseIdToken(token: string): Promise<VerifiedFirebaseUser> {
  const projectId = env.firebase.projectId;
  if (!projectId) {
    throw new Error("Firebase project id is not configured.");
  }

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  const uid = String(payload.sub ?? "");
  if (!uid) {
    throw new Error("Firebase token is missing a subject.");
  }

  return {
    uid,
    email: typeof payload.email === "string" ? payload.email : null,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : null,
  };
}
