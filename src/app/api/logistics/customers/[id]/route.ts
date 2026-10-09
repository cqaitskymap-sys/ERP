import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadCustomerDistribution } from "@/lib/logistics/query";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["warehouse:read", "customers:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const { id } = await context.params;
    const result = await loadCustomerDistribution(id, requireIdToken(request));
    if (!result) throw createNamedError("NotFoundError", "Customer was not found.");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
