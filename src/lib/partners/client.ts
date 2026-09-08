import { getFirebaseAuth } from "@/lib/firebase/client";
import { publicMasterError } from "@/lib/masters/errors";
import { uploadFile } from "@/lib/services/storage-service";
import { assertAllowedDocument, partnerDocumentPath } from "@/lib/partners/files";

async function token() {
  const value = await getFirebaseAuth().currentUser?.getIdToken();
  if (!value) throw new Error("Sign in is required for this action.");
  return value;
}

async function partnerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const idToken = await token();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-firebase-id-token": idToken,
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!response.ok) {
    throw new Error(body.error || publicMasterError(new Error("Request failed.")));
  }
  return body;
}

export async function getPartnerDashboard() {
  return partnerFetch<{
    stats: {
      window: number;
      customers: Record<string, number>;
      vendors: Record<string, number>;
    };
  }>("/api/partners/dashboard");
}

export async function uploadPartnerDocument(options: {
  kind: "customers" | "vendors";
  parentId: string;
  file: File;
  values: Record<string, unknown>;
}) {
  assertAllowedDocument({
    name: options.file.name,
    type: options.file.type,
    size: options.file.size,
  });
  const documentId = crypto.randomUUID();
  const storagePath = partnerDocumentPath(
    options.kind,
    options.parentId,
    documentId,
    options.file.name
  );
  await uploadFile(storagePath, options.file, { contentType: options.file.type });
  return partnerFetch<{ record: Record<string, unknown> & { id: string } }>(
    "/api/partners/documents",
    {
      method: "POST",
      body: JSON.stringify({
        ...options.values,
        kind: options.kind,
        documentId,
        storagePath,
        fileName: options.file.name,
        contentType: options.file.type,
        fileSize: options.file.size,
        customerId: options.kind === "customers" ? options.parentId : undefined,
        vendorId: options.kind === "vendors" ? options.parentId : undefined,
      }),
    }
  );
}
