import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/server";
import { masterErrorResponse, requireIdToken, requireMasterEntity } from "@/lib/masters/http";
import { masterPermission } from "@/lib/masters/permissions";
import { isAllowedMasterStatus } from "@/lib/masters/status";
import { setMasterStatus } from "@/lib/masters/server";
import { permissionForPartnerTransition } from "@/lib/partners/status";

export async function POST(
  request: Request,
  context: { params: Promise<{ entity: string; id: string }> }
) {
  try {
    const { entity, id } = await context.params;
    const master = requireMasterEntity(entity);
    const body = (await request.json()) as {
      status?: string;
      idToken?: string;
      reason?: string;
    };
    if (!body.status || !isAllowedMasterStatus(body.status)) {
      return NextResponse.json({ ok: false, error: "A valid status is required." }, { status: 400 });
    }
    const needed =
      master === "customers" || master === "vendors"
        ? permissionForPartnerTransition(master, body.status)
        : masterPermission(
            master,
            body.status === "inactive" || body.status === "discontinued"
              ? "delete"
              : body.status === "approved"
                ? "approve"
                : "update"
          );
    const session = await requirePermission(needed);
    const idToken = requireIdToken(request, body);
    const record = await setMasterStatus({
      entity: master,
      id,
      status: body.status,
      session,
      idToken,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
