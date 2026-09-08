import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { createQaRecord } from "@/lib/qa/dispatch";
import { isQaResource, QA_RESOURCES, READ_ALIASES } from "@/lib/qa/http";
import { listQaRecords } from "@/lib/qa/query";

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isQaResource(resource)) throw createNamedError("ValidationError", "Unknown QA resource.");
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listQaRecords(
      QA_RESOURCES[resource].collection,
      {
        status: url.searchParams.get("status") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        batchNumber: url.searchParams.get("batchNumber") || undefined,
        ownerId: url.searchParams.get("ownerId") || undefined,
        severity: url.searchParams.get("severity") || undefined,
        search: url.searchParams.get("search") || undefined,
        pageSize: Number(url.searchParams.get("pageSize") || 20),
        cursor: url.searchParams.get("cursor") || undefined,
      },
      idToken
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isQaResource(resource)) throw createNamedError("ValidationError", "Unknown QA resource.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    const result = await createQaRecord(resource, body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
