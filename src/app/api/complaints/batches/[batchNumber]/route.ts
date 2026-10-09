import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadBatchComplaintView } from "@/lib/complaints/query";

export async function GET(request: Request, context: { params: Promise<{ batchNumber: string }> }) {
  try {
    const { batchNumber } = await context.params;
    const session = await requireSession();
    if (!canAccessAny(session, ["complaints:read", "complaintCase:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const result = await loadBatchComplaintView(decodeURIComponent(batchNumber), idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
