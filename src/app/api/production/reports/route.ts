import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadProductionReport } from "@/lib/production/query";
import { PRODUCTION_REPORT_TYPES } from "@/types/production";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["production:read", "manufacturingOrder:read", "productionPlan:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "";
    if (!PRODUCTION_REPORT_TYPES.includes(type as (typeof PRODUCTION_REPORT_TYPES)[number])) {
      throw createNamedError("ValidationError", "Unknown production report.");
    }
    const result = await loadProductionReport(
      type as (typeof PRODUCTION_REPORT_TYPES)[number],
      {
        status: url.searchParams.get("status") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        plantId: url.searchParams.get("plantId") || undefined,
        workCenterId: url.searchParams.get("workCenterId") || undefined,
        batchNumber: url.searchParams.get("batchNumber") || undefined,
        pageSize: Number(url.searchParams.get("pageSize") || 50),
      },
      idToken
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
