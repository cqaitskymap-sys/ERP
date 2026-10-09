import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { findRelatedComplaints } from "@/lib/complaints/server";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["complaintCase:read", "complaintIntake:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const rows = await findRelatedComplaints({
      productId: url.searchParams.get("productId") || undefined,
      batchNumber: url.searchParams.get("batchNumber") || undefined,
      customerId: url.searchParams.get("customerId") || undefined,
      category: url.searchParams.get("category") || undefined,
      excludeId: url.searchParams.get("excludeId") || undefined,
    }, idToken);
    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
