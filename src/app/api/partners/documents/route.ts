import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/server";
import { writeAuditLog } from "@/lib/auth/firestore-rest";
import { createNamedError } from "@/lib/masters/errors";
import { readMasterDocument, writeMasterDocument } from "@/lib/masters/firestore";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import {
  assertAllowedDocument,
  isOwnedDocumentPath,
} from "@/lib/partners/files";
import { parseForm } from "@/lib/validation/schemas";
import { customerDocumentSchema, vendorDocumentSchema } from "@/lib/validation/partners";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const kind = body.kind === "vendors" ? "vendors" : "customers";
    const permissionModule = kind === "customers" ? "customers" : "vendors";
    const session = await requirePermission(`${permissionModule}:create`);
    const idToken = requireIdToken(request, body);
    const parentId = String(kind === "customers" ? body.customerId : body.vendorId || "");
    if (!parentId) {
      throw createNamedError("ValidationError", "A parent record is required.");
    }
    const parent = await readMasterDocument(kind, parentId, idToken);
    if (!parent) {
      throw createNamedError("ValidationError", "Parent record was not found.");
    }

    assertAllowedDocument({
      name: String(body.fileName || ""),
      type: String(body.contentType || ""),
      size: Number(body.fileSize || 0),
    });

    const documentId = String(body.documentId || crypto.randomUUID());
    const storagePath = String(body.storagePath || "");
    if (!isOwnedDocumentPath(storagePath, kind, parentId, documentId)) {
      throw createNamedError("ValidationError", "The storage path does not match this document.");
    }

    const parsed =
      kind === "customers"
        ? parseForm(customerDocumentSchema, {
            ...body,
            customerId: parentId,
            status: body.status || "active",
          })
        : parseForm(vendorDocumentSchema, {
            ...body,
            vendorId: parentId,
            status: body.status || "active",
          });
    if (!parsed.data) {
      throw createNamedError(
        "ValidationError",
        Object.values(parsed.errors)[0] || "Please correct the highlighted fields."
      );
    }

    const now = new Date().toISOString();
    const record = {
      ...parsed.data,
      documentId,
      storagePath,
      fileName: String(body.fileName),
      contentType: String(body.contentType),
      fileSize: Number(body.fileSize),
      uploadedBy: session.uid,
      uploadedAt: now,
      createdBy: session.uid,
      createdAt: now,
      updatedBy: session.uid,
      updatedAt: now,
    };
    const collection = kind === "customers" ? "customerDocuments" : "vendorDocuments";
    await writeMasterDocument(collection, documentId, record, idToken);
    await writeAuditLog(idToken, {
      actorId: session.uid,
      actorEmail: session.email,
      action: "DOCUMENT_UPLOADED",
      module: permissionModule,
      resource: collection,
      resourceId: documentId,
      description: `Uploaded ${String(body.fileName)} for ${kind.slice(0, -1)} ${parentId}.`,
      severity: "notice",
      newData: { documentId, storagePath, fileName: body.fileName },
      createdAt: now,
    });
    return NextResponse.json({ ok: true, record: { id: documentId, ...record } });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
