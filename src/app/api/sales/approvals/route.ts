import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadPendingSalesApprovals } from "@/lib/sales/query";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (
      !canAccessAny(session, [
        "salesOrder:approve",
        "salesQuotation:approve",
        "sales:read",
        "salesOrder:read",
      ])
    ) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const result = await loadPendingSalesApprovals(idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
