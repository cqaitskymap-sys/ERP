import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadPvReport } from "@/lib/pv/query";
import { PV_REPORT_TYPES } from "@/types/pv";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, ["pvReports:read", "pv:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "";
    if (!PV_REPORT_TYPES.includes(type as (typeof PV_REPORT_TYPES)[number])) {
      throw createNamedError("ValidationError", "Unknown PV report.");
    }
    const result = await loadPvReport(
      type as (typeof PV_REPORT_TYPES)[number],
      {
        status: url.searchParams.get("status") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        batchNumber: url.searchParams.get("batchNumber") || undefined,
        marketId: url.searchParams.get("marketId") || undefined,
        country: url.searchParams.get("country") || undefined,
        pageSize: Number(url.searchParams.get("pageSize") || 50),
      },
      idToken
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
