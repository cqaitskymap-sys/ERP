import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { createCostingRecord } from "@/lib/costing/dispatch";
import { isCostingResource, READ_ALIASES } from "@/lib/costing/http";
import { listCostingRecords } from "@/lib/costing/query";

export async function GET(
  request: Request,
  context: { params: Promise<{ resource: string }> }
) {
  try {
    const { resource } = await context.params;
    if (!isCostingResource(resource)) throw createNamedError("ValidationError", "Unknown costing resource.");
    const session = await requireSession();
    if (!canAccessAny(session, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listCostingRecords(
      resource,
      {
        status: url.searchParams.get("status") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        batchNumber: url.searchParams.get("batchNumber") || undefined,
        manufacturingOrderId: url.searchParams.get("manufacturingOrderId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        costCenterId: url.searchParams.get("costCenterId") || undefined,
        departmentId: url.searchParams.get("departmentId") || undefined,
        siteId: url.searchParams.get("siteId") || undefined,
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
    if (!isCostingResource(resource)) throw createNamedError("ValidationError", "Unknown costing resource.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    const result = await createCostingRecord(resource, body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
