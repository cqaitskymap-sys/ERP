import { NextResponse } from "next/server";
import { getFirebaseConfigStatus } from "@/lib/env";
import { getFirebaseInitSnapshot, getFirebaseApp } from "@/lib/firebase/client";
import { appConfig } from "@/lib/config/app";

export function GET() {
  const firebase = getFirebaseConfigStatus();
  let initialized = false;
  let initError: string | null = null;

  if (firebase.configured) {
    try {
      getFirebaseApp();
      initialized = true;
    } catch (error) {
      initError = error instanceof Error ? error.message : "Firebase init failed";
    }
  }

  const snapshot = getFirebaseInitSnapshot();

  return NextResponse.json({
    ok: firebase.configured && initialized,
    service: appConfig.name,
    firebase: {
      configured: firebase.configured,
      initialized,
      projectId: firebase.projectId,
      missing: firebase.missing,
      appsInitialized: snapshot.appsInitialized,
      initError,
    },
    authRequired: appConfig.requireAuth,
    timestamp: new Date().toISOString(),
  });
}
