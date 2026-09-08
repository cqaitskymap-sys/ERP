import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { isWarehouseResource, READ_ALIASES } from "@/lib/inventory/http";
import { WAREHOUSE_RESOURCES } from "@/lib/inventory/http";
import { createWarehouseRecord } from "@/lib/inventory/dispatch";
import { listInventoryRecords } from "@/lib/inventory/query";
import { createNamedError } from "@/lib/masters/errors";

export async function GET(
  request: Request,
  context: { params: Promise<{ resource: string }> }
) {
  try {
    const { resource } = await context.params;
    if (!isWarehouseResource(resource)) throw createNamedError("ValidationError", "Unknown warehouse resource.");
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listInventoryRecords(
      WAREHOUSE_RESOURCES[resource].collection,
      {
        status: url.searchParams.get("status") || undefined,
        qualityStatus: url.searchParams.get("qualityStatus") || undefined,
        inventoryStatus: url.searchParams.get("inventoryStatus") || undefined,
        warehouseId: url.searchParams.get("warehouseId") || undefined,
        locationId: url.searchParams.get("locationId") || undefined,
        itemType: url.searchParams.get("itemType") || undefined,
        itemId: url.searchParams.get("itemId") || undefined,
        materialId: url.searchParams.get("materialId") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        batchNumber: url.searchParams.get("batchNumber") || undefined,
        expiry: url.searchParams.get("expiry") || undefined,
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
    if (!isWarehouseResource(resource)) throw createNamedError("ValidationError", "Unknown warehouse resource.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    const result = await createWarehouseRecord(resource, body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
