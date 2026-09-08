import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadComplaintResourceDetail } from "@/lib/complaints/dispatch";
import { isComplaintResource, READ_ALIASES } from "@/lib/complaints/http";

export async function GET(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const { resource, id } = await context.params;
    if (!isComplaintResource(resource)) throw createNamedError("ValidationError", "Unknown complaint resource.");
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const result = await loadComplaintResourceDetail(resource, id, session, idToken);
    if (!result) throw createNamedError("ValidationError", "Record was not found.");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
