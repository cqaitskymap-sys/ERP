import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccess } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadArtworkDashboard } from "@/lib/artwork/query";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccess(session, "artwork:read")) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const stats = await loadArtworkDashboard(idToken);
    return NextResponse.json({ ok: true, ...stats });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
