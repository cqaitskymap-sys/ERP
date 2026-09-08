import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadProcurementDashboard } from "@/lib/procurement/query";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, ["procurement:read", "purchaseRequisition:read", "purchaseOrder:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const stats = await loadProcurementDashboard(idToken);
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
