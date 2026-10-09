import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadFinanceDashboard } from "@/lib/finance/query";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["finance:read", "financeAccounts:read", "financeAp:read", "financeAr:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const stats = await loadFinanceDashboard(idToken, {
      supplierId: url.searchParams.get("supplierId") || undefined,
      customerId: url.searchParams.get("customerId") || undefined,
      departmentId: url.searchParams.get("departmentId") || undefined,
      costCenterId: url.searchParams.get("costCenterId") || undefined,
      periodId: url.searchParams.get("periodId") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
    });
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
