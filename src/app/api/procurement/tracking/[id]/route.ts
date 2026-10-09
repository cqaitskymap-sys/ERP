import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadPurchaseTracking } from "@/lib/procurement/query";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["purchaseTracking:read", "purchaseOrder:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const { id } = await context.params;
    const idToken = requireIdToken(request);
    const result = await loadPurchaseTracking(id, idToken);
    if (!result) throw createNamedError("ValidationError", "Purchase order was not found.");
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
