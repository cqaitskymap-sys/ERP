import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { createProcurementRecord } from "@/lib/procurement/dispatch";
import { isProcurementResource, PROCUREMENT_RESOURCES, READ_ALIASES } from "@/lib/procurement/http";
import { listProcurementRecords } from "@/lib/procurement/query";

export async function GET(
  request: Request,
  context: { params: Promise<{ resource: string }> }
) {
  try {
    const { resource } = await context.params;
    if (!isProcurementResource(resource)) throw createNamedError("ValidationError", "Unknown procurement resource.");
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listProcurementRecords(
      PROCUREMENT_RESOURCES[resource].collection,
      {
        status: url.searchParams.get("status") || undefined,
        vendorId: url.searchParams.get("vendorId") || undefined,
        materialId: url.searchParams.get("materialId") || undefined,
        departmentId: url.searchParams.get("departmentId") || undefined,
        plantId: url.searchParams.get("plantId") || undefined,
        requester: url.searchParams.get("requester") || undefined,
        requisitionId: url.searchParams.get("requisitionId") || undefined,
        rfqId: url.searchParams.get("rfqId") || undefined,
        purchaseOrderId: url.searchParams.get("purchaseOrderId") || undefined,
        approvalStatus: url.searchParams.get("approvalStatus") || undefined,
        search: url.searchParams.get("search") || undefined,
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
    if (!isProcurementResource(resource)) throw createNamedError("ValidationError", "Unknown procurement resource.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    const result = await createProcurementRecord(resource, body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
