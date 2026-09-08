import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { selectFefoForItem } from "@/lib/inventory/server";
import { createNamedError } from "@/lib/masters/errors";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, ["stockIssue:create", "inventory:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const itemId = url.searchParams.get("itemId") || url.searchParams.get("materialId") || "";
    if (!itemId) throw createNamedError("ValidationError", "Material or product is required.");
    const selection = await selectFefoForItem({
      itemId,
      quantity: Number(url.searchParams.get("quantity") || 0),
      warehouseId: url.searchParams.get("warehouseId") || undefined,
      locationId: url.searchParams.get("locationId") || undefined,
      batchNumber: url.searchParams.get("batchNumber") || undefined,
      idToken,
    });
    return NextResponse.json({ ok: true, selection });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
