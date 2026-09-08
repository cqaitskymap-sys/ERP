import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadProductionDashboard } from "@/lib/production/query";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, ["production:read", "productionPlan:read", "manufacturingOrder:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const stats = await loadProductionDashboard(idToken);
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
