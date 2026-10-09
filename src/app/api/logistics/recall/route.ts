import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadRecallDistribution } from "@/lib/logistics/query";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["warehouse:read", "complaintRecall:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const batchNumber = new URL(request.url).searchParams.get("batchNumber") || "";
    if (!batchNumber) throw createNamedError("ValidationError", "Batch number is required.");
    const result = await loadRecallDistribution(batchNumber, requireIdToken(request));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
