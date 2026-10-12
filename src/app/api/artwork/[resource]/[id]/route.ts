import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccess } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { isArtworkResource } from "@/lib/artwork/collections";
import { loadArtworkDetail } from "@/lib/artwork/server";

export async function GET(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const { resource, id } = await context.params;
    if (!isArtworkResource(resource)) throw createNamedError("ValidationError", "Unknown artwork resource.");
    const session = await requireSession();
    if (!canAccess(session, "artwork:read")) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const result = await loadArtworkDetail(resource, id, idToken);
    if (!result) throw createNamedError("ValidationError", "Record was not found.");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
