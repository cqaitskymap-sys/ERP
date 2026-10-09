import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadEngineeringDetail } from "@/lib/engineering/dispatch";
import { isEngineeringResource, READ_ALIASES } from "@/lib/engineering/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  try {
    const { resource, id } = await context.params;
    if (!isEngineeringResource(resource)) throw createNamedError("ValidationError", "Unknown engineering resource.");
    const session = await requireSession();
    if (!canAccessAny(session, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const result = await loadEngineeringDetail(resource, id, idToken, session);
    if (!result) throw createNamedError("NotFoundError", "Record was not found.");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
