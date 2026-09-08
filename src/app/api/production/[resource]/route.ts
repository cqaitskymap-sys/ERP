import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { createProductionRecord } from "@/lib/production/dispatch";
import { isProductionResource, PRODUCTION_RESOURCES, READ_ALIASES } from "@/lib/production/http";
import { listProductionRecords } from "@/lib/production/query";

export async function GET(
  request: Request,
  context: { params: Promise<{ resource: string }> }
) {
  try {
    const { resource } = await context.params;
    if (!isProductionResource(resource)) throw createNamedError("ValidationError", "Unknown production resource.");
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listProductionRecords(
      PRODUCTION_RESOURCES[resource].collection,
      {
        status: url.searchParams.get("status") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        plantId: url.searchParams.get("plantId") || undefined,
        workCenterId: url.searchParams.get("workCenterId") || undefined,
        batchNumber: url.searchParams.get("batchNumber") || undefined,
        manufacturingOrderId: url.searchParams.get("manufacturingOrderId") || undefined,
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

export async function POST(
  request: Request,
  context: { params: Promise<{ resource: string }> }
) {
  try {
    const { resource } = await context.params;
    if (!isProductionResource(resource)) throw createNamedError("ValidationError", "Unknown production resource.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    const result = await createProductionRecord(resource, body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
