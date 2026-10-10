import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadDmsReport } from "@/lib/dms/query";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["dmsReports:read", "dms:read", "dmsReports:export"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await loadDmsReport(
      url.searchParams.get("type") || "registry",
      {
        status: url.searchParams.get("status") || undefined,
        documentType: url.searchParams.get("documentType") || undefined,
        departmentId: url.searchParams.get("departmentId") || undefined,
        ownerId: url.searchParams.get("ownerId") || undefined,
        siteId: url.searchParams.get("siteId") || undefined,
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
