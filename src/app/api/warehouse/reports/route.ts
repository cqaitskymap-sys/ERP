import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { loadWarehouseReport } from "@/lib/inventory/query";
import { createNamedError } from "@/lib/masters/errors";
import { INVENTORY_REPORT_TYPES } from "@/types/inventory";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, ["inventory:read", "inventory:export"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "current_stock";
    if (!INVENTORY_REPORT_TYPES.includes(type as (typeof INVENTORY_REPORT_TYPES)[number])) {
      throw createNamedError("ValidationError", "Unknown report type.");
    }
    const result = await loadWarehouseReport(
      type as (typeof INVENTORY_REPORT_TYPES)[number],
      {
        warehouseId: url.searchParams.get("warehouseId") || undefined,
        locationId: url.searchParams.get("locationId") || undefined,
        materialId: url.searchParams.get("materialId") || undefined,
        itemId: url.searchParams.get("itemId") || undefined,
        batchNumber: url.searchParams.get("batchNumber") || undefined,
        qualityStatus: url.searchParams.get("qualityStatus") || undefined,
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
        search: url.searchParams.get("search") || undefined,
        pageSize: Number(url.searchParams.get("pageSize") || 100),
      },
      idToken
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
