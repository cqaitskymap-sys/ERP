import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { loadPartnerDashboard } from "@/lib/partners/dashboard";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["customers:read", "vendors:read"])) {
      return NextResponse.json({ ok: false, error: "You do not have permission for this action." }, { status: 403 });
    }
    const idToken = requireIdToken(request);
    const stats = await loadPartnerDashboard(idToken);
    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
