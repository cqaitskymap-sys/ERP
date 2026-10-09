import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadLogisticsReport } from "@/lib/logistics/query";
import { LOGISTICS_REPORT_TYPES } from "@/types/logistics";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["warehouseLogisticsReports:read", "warehouse:read", "inventory:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "";
    if (!LOGISTICS_REPORT_TYPES.includes(type as (typeof LOGISTICS_REPORT_TYPES)[number])) {
      throw createNamedError("ValidationError", "Unknown logistics report.");
    }
    const result = await loadLogisticsReport(
      type as (typeof LOGISTICS_REPORT_TYPES)[number],
      {
        status: url.searchParams.get("status") || undefined,
        warehouseId: url.searchParams.get("warehouseId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
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
