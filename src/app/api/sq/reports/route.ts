import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadSqReport } from "@/lib/supplier-quality/query";
import { SQ_REPORT_TYPES } from "@/types/supplier-quality";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, ["supplierQualityReports:read", "supplierQuality:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "";
    if (!SQ_REPORT_TYPES.includes(type as (typeof SQ_REPORT_TYPES)[number])) {
      throw createNamedError("ValidationError", "Unknown supplier-quality report.");
    }
    const result = await loadSqReport(
      type as (typeof SQ_REPORT_TYPES)[number],
      {
        status: url.searchParams.get("status") || undefined,
        supplierId: url.searchParams.get("supplierId") || undefined,
        materialId: url.searchParams.get("materialId") || undefined,
        riskLevel: url.searchParams.get("riskLevel") || undefined,
        pageSize: Number(url.searchParams.get("pageSize") || 50),
      },
      idToken
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
