import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type Unsubscribe,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getDocument, updateDocument } from "@/lib/services/firestore-service";
import { normalizeUserProfile } from "@/lib/auth/firestore-rest";
import { USERS_COLLECTION } from "@/lib/auth/constants";
import type { AuthUser, SignInPayload, UserProfile } from "@/types/auth";

export function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
  };
}

export async function fetchUserProfile(uid: string) {
  const raw = await getDocument<Record<string, unknown>>(USERS_COLLECTION, uid);
  if (!raw) return null;
  return normalizeUserProfile(uid, raw);
}

export async function establishSession(idToken: string, remember: boolean) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, remember }),
  });
  const body = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok) {
    throw new Error(body.error || "Unable to establish a secure session.");
  }
  return body;
}

export async function destroySession() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
}

export async function signIn({ email, password, remember = true }: SignInPayload) {
  await setPersistence(
    getFirebaseAuth(),
    remember ? browserLocalPersistence : browserSessionPersistence
  );

  const credential = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    email,
    password
  );
  const profile = await fetchUserProfile(credential.user.uid);

  if (!profile) {
    await signOut(getFirebaseAuth());
    throw Object.assign(new Error("This account has not been provisioned by HR or Admin."), {
      code: "app/not-provisioned",
    });
  }

  if (profile.status !== "active") {
    await signOut(getFirebaseAuth());
    throw Object.assign(
      new Error(
        profile.status === "invited"
          ? "This account is invited but not activated."
          : "This account is deactivated. Contact HR or a system administrator."
      ),
      { code: "app/inactive" }
    );
  }

  try {
    await updateDocument(USERS_COLLECTION, credential.user.uid, {
      lastLoginAt: new Date().toISOString(),
      email: credential.user.email,
    });
  } catch (error) {
    console.warn("Last login update skipped:", error);
  }

  const idToken = await credential.user.getIdToken();
  await establishSession(idToken, remember);

  return {
    user: toAuthUser(credential.user),
    profile: { ...profile, lastLoginAt: new Date().toISOString() },
  };
}

export async function requestPasswordReset(email: string) {
  await sendPasswordResetEmail(getFirebaseAuth(), email);
}

export async function signOutUser() {
  await destroySession();
  await signOut(getFirebaseAuth());
}

export function subscribeToAuth(
  onChange: (user: AuthUser | null, profile: UserProfile | null) => void
): Unsubscribe {
  return onAuthStateChanged(getFirebaseAuth(), async (user) => {
    if (!user) {
      onChange(null, null);
      return;
    }

    try {
      const profile = await fetchUserProfile(user.uid);
      onChange(toAuthUser(user), profile);
    } catch {
      onChange(toAuthUser(user), null);
    }
  });
}

export function mapAuthError(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code)
      : "";
  const message = error instanceof Error ? error.message : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password is incorrect.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 8 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/invalid-email":
      return "Enter a valid work email address.";
    case "auth/user-disabled":
      return "This Firebase account has been disabled.";
    case "app/not-provisioned":
    case "app/inactive":
      return message;
    default:
      return message || "Unable to complete authentication.";
  }
}
