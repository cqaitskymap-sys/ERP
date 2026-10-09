import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadHrReport } from "@/lib/hr/query";
import { HR_REPORT_TYPES, type HrReportType } from "@/types/hr";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["hr:read", "hrReports:export", "hrReports:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const type = String(url.searchParams.get("type") || "employee_directory");
    if (!HR_REPORT_TYPES.includes(type as HrReportType)) {
      throw createNamedError("ValidationError", "Unknown HR report type.");
    }
    const result = await loadHrReport(
      type as HrReportType,
      {
        status: url.searchParams.get("status") || undefined,
        departmentId: url.searchParams.get("departmentId") || undefined,
        employeeId: url.searchParams.get("employeeId") || undefined,
        facilityId: url.searchParams.get("facilityId") || undefined,
        search: url.searchParams.get("search") || undefined,
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
        pageSize: Number(url.searchParams.get("pageSize") || 50),
        cursor: url.searchParams.get("cursor") || undefined,
      },
      idToken,
      session
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
