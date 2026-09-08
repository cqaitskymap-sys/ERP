import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadRaReport } from "@/lib/ra/query";
import { RA_REPORT_TYPES } from "@/types/ra";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, ["ra:read", "raReports:read", "regulatory:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "";
    if (!RA_REPORT_TYPES.includes(type as (typeof RA_REPORT_TYPES)[number])) {
      throw createNamedError("ValidationError", "Unknown RA report.");
    }
    const result = await loadRaReport(
      type as (typeof RA_REPORT_TYPES)[number],
      {
        status: url.searchParams.get("status") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        marketId: url.searchParams.get("marketId") || undefined,
        authorityId: url.searchParams.get("authorityId") || undefined,
        ownerId: url.searchParams.get("ownerId") || undefined,
        pageSize: Number(url.searchParams.get("pageSize") || 50),
      },
      idToken
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
