import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { findPotentialDuplicates } from "@/lib/pv/server";
import { redactCaseForList } from "@/lib/pv/helpers";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, ["pvCase:read", "pvIntake:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const rows = await findPotentialDuplicates({
      productId: url.searchParams.get("productId") || undefined,
      batchNumber: url.searchParams.get("batchNumber") || undefined,
      country: url.searchParams.get("country") || undefined,
      eventTerm: url.searchParams.get("eventTerm") || undefined,
    }, idToken);
    return NextResponse.json({ ok: true, rows: rows.map((row) => redactCaseForList(row)) });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
