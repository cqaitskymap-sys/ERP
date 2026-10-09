import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { createPvRecord } from "@/lib/pv/dispatch";
import { isPvResource, PV_RESOURCES, READ_ALIASES } from "@/lib/pv/http";
import { listPvRecords } from "@/lib/pv/query";

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isPvResource(resource)) throw createNamedError("ValidationError", "Unknown PV resource.");
    const session = await requireSession();
    if (!canAccessAny(session, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listPvRecords(
      PV_RESOURCES[resource].collection,
      {
        status: url.searchParams.get("status") || undefined,
        priority: url.searchParams.get("priority") || undefined,
        seriousness: url.searchParams.get("seriousness") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        marketId: url.searchParams.get("marketId") || undefined,
        country: url.searchParams.get("country") || undefined,
        batchNumber: url.searchParams.get("batchNumber") || undefined,
        assignedTo: url.searchParams.get("assignedTo") || undefined,
        ownerId: url.searchParams.get("ownerId") || undefined,
        caseId: url.searchParams.get("caseId") || undefined,
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
    if (!isPvResource(resource)) throw createNamedError("ValidationError", "Unknown PV resource.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    const result = await createPvRecord(resource, body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
