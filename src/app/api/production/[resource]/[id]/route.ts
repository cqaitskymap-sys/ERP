import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadProductionDetail } from "@/lib/production/dispatch";
import { isProductionResource, READ_ALIASES } from "@/lib/production/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const { resource, id } = await context.params;
    if (!isProductionResource(resource)) throw createNamedError("ValidationError", "Unknown production resource.");
    const session = await requireSession();
    if (!canAccessAny(session, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const result = await loadProductionDetail(resource, id, idToken);
    if (!result) throw createNamedError("ValidationError", "Record was not found.");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
