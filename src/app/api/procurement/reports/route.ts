import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadProcurementReport } from "@/lib/procurement/query";
import { PROCUREMENT_REPORT_TYPES } from "@/types/procurement";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, ["procurement:read", "purchaseOrder:export", "purchaseOrder:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "";
    if (!PROCUREMENT_REPORT_TYPES.includes(type as (typeof PROCUREMENT_REPORT_TYPES)[number])) {
      throw createNamedError("ValidationError", "Unknown procurement report.");
    }
    const result = await loadProcurementReport(
      type as (typeof PROCUREMENT_REPORT_TYPES)[number],
      {
        status: url.searchParams.get("status") || undefined,
        vendorId: url.searchParams.get("vendorId") || undefined,
        materialId: url.searchParams.get("materialId") || undefined,
        departmentId: url.searchParams.get("departmentId") || undefined,
        plantId: url.searchParams.get("plantId") || undefined,
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
        pageSize: Number(url.searchParams.get("pageSize") || 50),
      },
      idToken,
      session
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
