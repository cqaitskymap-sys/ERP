import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { createDmsRecord } from "@/lib/dms/dispatch";
import { isDmsResource, READ_ALIASES } from "@/lib/dms/http";
import { listDmsRecords } from "@/lib/dms/query";

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isDmsResource(resource)) throw createNamedError("ValidationError", "Unknown document-control resource.");
    const session = await requireSession();
    if (!canAccessAny(session, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listDmsRecords(
      resource,
      {
        status: url.searchParams.get("status") || undefined,
        documentType: url.searchParams.get("documentType") || undefined,
        departmentId: url.searchParams.get("departmentId") || undefined,
        ownerId: url.searchParams.get("ownerId") || undefined,
        siteId: url.searchParams.get("siteId") || undefined,
        classification: url.searchParams.get("classification") || undefined,
        review: url.searchParams.get("review") || undefined,
        search: url.searchParams.get("search") || undefined,
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
        pageSize: Number(url.searchParams.get("pageSize") || 20),
        cursor: url.searchParams.get("cursor") || undefined,
      },
      idToken,
      session
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isDmsResource(resource)) throw createNamedError("ValidationError", "Unknown document-control resource.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    const result = await createDmsRecord(resource, body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
