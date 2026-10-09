import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadCostingReport } from "@/lib/costing/query";
import { COSTING_REPORT_TYPES, type CostingReportType } from "@/types/costing";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["costingReports:read", "costing:read", "costingReports:export"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const type = String(url.searchParams.get("type") || "batch_cost_register") as CostingReportType;
    if (!COSTING_REPORT_TYPES.includes(type)) {
      throw createNamedError("ValidationError", "Unknown costing report type.");
    }
    const result = await loadCostingReport(
      type,
      {
        productId: url.searchParams.get("productId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        costCenterId: url.searchParams.get("costCenterId") || undefined,
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
      },
      idToken,
      session
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
