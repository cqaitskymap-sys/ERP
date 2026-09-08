import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type UploadMetadata,
} from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase/client";

export async function uploadFile(
  path: string,
  file: Blob | Uint8Array | ArrayBuffer,
  metadata?: UploadMetadata
) {
  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, file, metadata);
  return getDownloadURL(storageRef);
}

export async function getFileUrl(path: string) {
  return getDownloadURL(ref(getFirebaseStorage(), path));
}

export async function deleteFile(path: string) {
  await deleteObject(ref(getFirebaseStorage(), path));
}

export function buildStoragePath(
  module: string,
  entityId: string,
  fileName: string
) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${module}/${entityId}/${Date.now()}-${safeName}`;
}
