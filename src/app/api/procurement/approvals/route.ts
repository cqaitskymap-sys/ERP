import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadPendingApprovals } from "@/lib/procurement/query";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (
      !hasAnyPermission(session.permissions, [
        "purchaseRequisition:approve",
        "purchaseOrder:approve",
        "vendorSelection:approve",
        "purchaseOrderAmendment:approve",
      ])
    ) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const result = await loadPendingApprovals(idToken, session);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
