export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENT_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/msword": [".doc"],
  "application/vnd.ms-excel": [".xls"],
};

export function extensionOf(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] || "";
}

export function assertAllowedDocument(file: { name: string; type: string; size: number }) {
  if (file.size <= 0 || file.size > MAX_DOCUMENT_BYTES) {
    throw new Error("File must be between 1 byte and 10 MB.");
  }
  const allowed = ALLOWED_DOCUMENT_TYPES[file.type];
  const extension = extensionOf(file.name);
  if (!allowed || !allowed.includes(extension)) {
    throw new Error("This file type is not allowed. Use PDF, image, Word, or Excel.");
  }
}

export function partnerDocumentPath(
  kind: "customers" | "vendors",
  parentId: string,
  documentId: string,
  fileName: string
) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${kind}/${parentId}/documents/${documentId}/${safeName}`;
}

export function isOwnedDocumentPath(
  path: string,
  kind: "customers" | "vendors",
  parentId: string,
  documentId: string
) {
  return path.startsWith(`${kind}/${parentId}/documents/${documentId}/`);
}
