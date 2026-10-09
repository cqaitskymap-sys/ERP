import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadCustomer360 } from "@/lib/sales/query";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await requireSession();
    if (!canAccessAny(session, ["sales:read", "customers:read", "salesOrder:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const result = await loadCustomer360(id, idToken, session);
    if (!result) throw createNamedError("NotFoundError", "Customer was not found.");
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
