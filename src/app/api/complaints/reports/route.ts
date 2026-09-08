import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadComplaintReport } from "@/lib/complaints/query";
import { COMPLAINT_REPORT_TYPES } from "@/types/complaints";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, ["complaintReports:read", "complaints:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "";
    if (!COMPLAINT_REPORT_TYPES.includes(type as (typeof COMPLAINT_REPORT_TYPES)[number])) {
      throw createNamedError("ValidationError", "Unknown complaint report.");
    }
    const result = await loadComplaintReport(
      type as (typeof COMPLAINT_REPORT_TYPES)[number],
      {
        status: url.searchParams.get("status") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        batchNumber: url.searchParams.get("batchNumber") || undefined,
        marketId: url.searchParams.get("marketId") || undefined,
        assignedTo: url.searchParams.get("assignedTo") || undefined,
        pageSize: Number(url.searchParams.get("pageSize") || 50),
      },
      idToken
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
