import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { createSalesRecord } from "@/lib/sales/dispatch";
import { isSalesResource, SALES_RESOURCES, READ_ALIASES } from "@/lib/sales/http";
import { listSalesRecords } from "@/lib/sales/query";

export async function GET(
  request: Request,
  context: { params: Promise<{ resource: string }> }
) {
  try {
    const { resource } = await context.params;
    if (!isSalesResource(resource)) throw createNamedError("ValidationError", "Unknown sales resource.");
    const session = await requireSession();
    if (!canAccessAny(session, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listSalesRecords(
      SALES_RESOURCES[resource].collection,
      {
        status: url.searchParams.get("status") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        salesRepresentative: url.searchParams.get("salesRepresentative") || undefined,
        orderType: url.searchParams.get("orderType") || undefined,
        approvalStatus: url.searchParams.get("approvalStatus") || undefined,
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
    if (!isSalesResource(resource)) throw createNamedError("ValidationError", "Unknown sales resource.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    const result = await createSalesRecord(resource, body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
