import { env, getFirebaseConfigStatus } from "@/lib/env";
import type { FirebaseOptions } from "firebase/app";

export function getFirebaseOptions(): FirebaseOptions {
  const status = getFirebaseConfigStatus();

  if (!status.configured) {
    throw new Error(
      `Firebase is not fully configured. Missing: ${status.missing.join(", ")}`
    );
  }

  return {
    apiKey: env.firebase.apiKey,
    authDomain: env.firebase.authDomain,
    projectId: env.firebase.projectId,
    storageBucket: env.firebase.storageBucket,
    messagingSenderId: env.firebase.messagingSenderId,
    appId: env.firebase.appId,
  };
}
