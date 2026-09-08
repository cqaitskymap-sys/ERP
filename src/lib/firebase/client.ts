import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirebaseOptions } from "@/lib/firebase/config";
import { getFirebaseConfigStatus } from "@/lib/env";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

export function isFirebaseReady() {
  return getFirebaseConfigStatus().configured;
}

export function getFirebaseApp() {
  if (app) return app;
  if (!isFirebaseReady()) {
    throw new Error("Firebase environment variables are incomplete.");
  }

  app = getApps().length > 0 ? getApp() : initializeApp(getFirebaseOptions());
  return app;
}

export function getFirebaseAuth() {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  return auth;
}

export function getFirebaseDb() {
  if (db) return db;
  db = getFirestore(getFirebaseApp());
  return db;
}

export function getFirebaseStorage() {
  if (storage) return storage;
  storage = getStorage(getFirebaseApp());
  return storage;
}

export function getFirebaseInitSnapshot() {
  const status = getFirebaseConfigStatus();

  return {
    ready: status.configured,
    projectId: status.projectId,
    missing: status.missing,
    appsInitialized: getApps().length,
  };
}
