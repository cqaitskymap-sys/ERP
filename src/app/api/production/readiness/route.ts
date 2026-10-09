import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { PRODUCTION_COLLECTIONS } from "@/lib/production/collections";
import { requireRecord } from "@/lib/production/helpers";
import { checkProductionReadiness } from "@/lib/production/readiness";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["manufacturingOrder:read", "production:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const id = new URL(request.url).searchParams.get("id") || "";
    if (!id) throw createNamedError("ValidationError", "Manufacturing order is required.");
    const order = await requireRecord(PRODUCTION_COLLECTIONS.orders, id, idToken, "Manufacturing order");
    const result = await checkProductionReadiness({ order, idToken });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
