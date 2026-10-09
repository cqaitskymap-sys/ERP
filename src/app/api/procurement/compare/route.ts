import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadQuotationComparison } from "@/lib/procurement/query";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["quotation:read", "quotation:evaluate"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const rfqId = new URL(request.url).searchParams.get("rfqId") || "";
    if (!rfqId) throw createNamedError("ValidationError", "RFQ is required.");
    const result = await loadQuotationComparison(rfqId, idToken, session);
    if (!result) throw createNamedError("ValidationError", "RFQ was not found.");
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
