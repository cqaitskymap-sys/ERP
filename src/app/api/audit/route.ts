import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasPermission } from "@/lib/permissions/permission-service";
import { queryMasterDocuments } from "@/lib/masters/firestore";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const resourceId = url.searchParams.get("resourceId") || "";
    const resource = url.searchParams.get("resource") || "";
    const canAudit = hasPermission(session.permissions, "audit:read");
    const canRelated =
      hasPermission(session.permissions, "products:read") ||
      hasPermission(session.permissions, "materials:read") ||
      hasPermission(session.permissions, "masters:read") ||
      hasPermission(session.permissions, "customers:read") ||
      hasPermission(session.permissions, "vendors:read");
    if (!canAudit && !canRelated) {
      return NextResponse.json({ ok: false, error: "You do not have permission for this action." }, { status: 403 });
    }
    if (!resourceId) {
      return NextResponse.json({ ok: false, error: "A record id is required." }, { status: 400 });
    }

    const idToken = requireIdToken(request);
    const rows = await queryMasterDocuments("audit_logs", idToken, {
      filters: [
        { field: "resourceId", value: resourceId },
        ...(resource ? [{ field: "resource", value: resource }] : []),
      ],
      orderBy: [{ field: "createdAt", direction: "DESCENDING" }],
      limit: 40,
    });
    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
