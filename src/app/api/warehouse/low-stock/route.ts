import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { loadLowStock } from "@/lib/inventory/query";
import { createNamedError } from "@/lib/masters/errors";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["inventory:read", "materials:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const rows = await loadLowStock(idToken);
    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
