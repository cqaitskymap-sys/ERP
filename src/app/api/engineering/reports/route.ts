import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadEngineeringReport } from "@/lib/engineering/query";
import { ENGINEERING_REPORT_TYPES, type EngineeringReportType } from "@/types/engineering";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["engineeringReports:read", "engineering:read", "engineeringReports:export"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const type = String(url.searchParams.get("type") || "equipment_register") as EngineeringReportType;
    if (!ENGINEERING_REPORT_TYPES.includes(type)) {
      throw createNamedError("ValidationError", "Unknown engineering report type.");
    }
    const result = await loadEngineeringReport(
      type,
      {
        facilityId: url.searchParams.get("facilityId") || undefined,
        departmentId: url.searchParams.get("departmentId") || undefined,
        category: url.searchParams.get("category") || undefined,
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
