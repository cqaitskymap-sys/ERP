function readBoolean(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  return value === "true" || value === "1";
}

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Aetheris",
  appShortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME?.trim() || "ATH",
  companyName:
    process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() ||
    "Contract Pharmaceutical Manufacturing",
  appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
  requireAuth: readBoolean(process.env.NEXT_PUBLIC_REQUIRE_AUTH, true),
  sessionSecret:
    process.env.SESSION_SECRET?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ||
    "dev-only-session-secret",
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || "",
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || "",
  },
};

export function getFirebaseConfigStatus() {
  const required = [
    ["NEXT_PUBLIC_FIREBASE_API_KEY", env.firebase.apiKey],
    ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", env.firebase.authDomain],
    ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", env.firebase.projectId],
    ["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", env.firebase.storageBucket],
    ["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", env.firebase.messagingSenderId],
    ["NEXT_PUBLIC_FIREBASE_APP_ID", env.firebase.appId],
  ] as const;

  const missing = required.filter(([, value]) => !value).map(([key]) => key);

  return {
    configured: missing.length === 0,
    missing,
    projectId: env.firebase.projectId || null,
  };
}
