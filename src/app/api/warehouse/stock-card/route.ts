import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { loadStockCard } from "@/lib/inventory/query";
import { createNamedError } from "@/lib/masters/errors";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["inventory:read", "inventory:export"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const card = await loadStockCard(
      {
        itemId: url.searchParams.get("itemId") || undefined,
        materialId: url.searchParams.get("materialId") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        batchNumber: url.searchParams.get("batchNumber") || undefined,
        warehouseId: url.searchParams.get("warehouseId") || undefined,
        locationId: url.searchParams.get("locationId") || undefined,
        qualityStatus: url.searchParams.get("qualityStatus") || undefined,
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
      },
      idToken
    );
    return NextResponse.json({ ok: true, card });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
