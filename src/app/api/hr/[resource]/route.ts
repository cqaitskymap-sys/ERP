import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { createHrRecord } from "@/lib/hr/dispatch";
import { isHrResource, READ_ALIASES } from "@/lib/hr/http";
import { listHrRecords } from "@/lib/hr/query";

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isHrResource(resource)) throw createNamedError("ValidationError", "Unknown HR resource.");
    const session = await requireSession();
    const needed = READ_ALIASES[resource];
    if (!canAccessAny(session, needed)) {
      throw createNamedError(
        "ForbiddenError",
        `Missing permission for ${resource}. Need one of: ${needed.join(", ")}.`
      );
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listHrRecords(
      resource,
      {
        status: url.searchParams.get("status") || undefined,
        departmentId: url.searchParams.get("departmentId") || undefined,
        designationId: url.searchParams.get("designationId") || undefined,
        employeeId: url.searchParams.get("employeeId") || undefined,
        facilityId: url.searchParams.get("facilityId") || undefined,
        search: url.searchParams.get("search") || undefined,
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
        pageSize: Number(url.searchParams.get("pageSize") || 20),
        cursor: url.searchParams.get("cursor") || undefined,
      },
      idToken,
      session
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[hr:list]", err.name, err.message);
    }
    return masterErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isHrResource(resource)) throw createNamedError("ValidationError", "Unknown HR resource.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    const result = await createHrRecord(resource, body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error("[hr:create]", err.name, err.message);
    }
    return masterErrorResponse(error);
  }
}
