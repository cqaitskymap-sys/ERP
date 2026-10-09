import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadMaterialPlan } from "@/lib/production/server";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["manufacturingOrder:read", "production:read", "bom:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const manufacturingOrderId = new URL(request.url).searchParams.get("manufacturingOrderId") || "";
    if (!manufacturingOrderId) throw createNamedError("ValidationError", "Manufacturing order is required.");
    const result = await loadMaterialPlan(manufacturingOrderId, idToken);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
