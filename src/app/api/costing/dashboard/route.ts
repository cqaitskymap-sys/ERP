import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadCostingDashboard } from "@/lib/costing/query";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["costing:read", "costingBatch:read", "costingStandard:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const stats = await loadCostingDashboard(idToken, {
      productId: url.searchParams.get("productId") || undefined,
      batchNumber: url.searchParams.get("batchNumber") || undefined,
      customerId: url.searchParams.get("customerId") || undefined,
      costCenterId: url.searchParams.get("costCenterId") || undefined,
      departmentId: url.searchParams.get("departmentId") || undefined,
      siteId: url.searchParams.get("siteId") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
    });
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
