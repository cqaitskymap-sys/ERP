import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { createEngineeringRecord } from "@/lib/engineering/dispatch";
import { isEngineeringResource, READ_ALIASES } from "@/lib/engineering/http";
import { listEngineeringRecords } from "@/lib/engineering/query";

export async function GET(
  request: Request,
  context: { params: Promise<{ resource: string }> }
) {
  try {
    const { resource } = await context.params;
    if (!isEngineeringResource(resource)) throw createNamedError("ValidationError", "Unknown engineering resource.");
    const session = await requireSession();
    if (!canAccessAny(session, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listEngineeringRecords(
      resource,
      {
        status: url.searchParams.get("status") || undefined,
        facilityId: url.searchParams.get("facilityId") || undefined,
        departmentId: url.searchParams.get("departmentId") || undefined,
        category: url.searchParams.get("category") || undefined,
        criticality: url.searchParams.get("criticality") || undefined,
        equipmentId: url.searchParams.get("equipmentId") || undefined,
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

export async function POST(
  request: Request,
  context: { params: Promise<{ resource: string }> }
) {
  try {
    const { resource } = await context.params;
    if (!isEngineeringResource(resource)) throw createNamedError("ValidationError", "Unknown engineering resource.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    const result = await createEngineeringRecord(resource, body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
