import { NextResponse } from "next/server";
import { authErrorResponse, requireSession } from "@/lib/auth/server";
import { canAccess, hasRole } from "@/lib/permissions/permission-service";
import type { AppRole, Permission } from "@/types/permissions";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as {
      permission?: Permission;
      role?: AppRole;
    };

    return NextResponse.json({
      ok: true,
      allowed: body.permission
        ? canAccess(session, body.permission)
        : body.role
          ? hasRole(session.roles, body.role)
          : true,
      role: session.role,
      permissions: session.permissions,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
