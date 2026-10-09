import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadEngineeringDashboard } from "@/lib/engineering/query";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["engineering:read", "engineeringEquipment:read", "maintenance:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const stats = await loadEngineeringDashboard(idToken, {
      facilityId: url.searchParams.get("facilityId") || undefined,
      departmentId: url.searchParams.get("departmentId") || undefined,
      category: url.searchParams.get("category") || undefined,
      criticality: url.searchParams.get("criticality") || undefined,
      status: url.searchParams.get("status") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
    });
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
