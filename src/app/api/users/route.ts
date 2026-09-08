import { NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth/server";
import {
  createIdentityUser,
  generateTemporaryPassword,
} from "@/lib/auth/identity-toolkit";
import {
  listUserProfiles,
  writeAuditLog,
  writeUserProfile,
} from "@/lib/auth/firestore-rest";
import { buildUserProfile } from "@/lib/auth/profile";
import { createUserSchema, parseForm } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const session = await requirePermission("users:read");
    const requestHeaders = await import("next/headers").then((mod) => mod.headers());
    const bearer = requestHeaders.get("x-firebase-id-token");

    if (!bearer) {
      return NextResponse.json({
        ok: true,
        users: [
          {
            uid: session.uid,
            employeeId: session.employeeId,
            name: session.name,
            email: session.email,
            role: session.role,
            status: session.status,
          },
        ],
        limited: true,
      });
    }

    const users = await listUserProfiles(bearer);
    return NextResponse.json({ ok: true, users, limited: false });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission("users:create");
    const body = await request.json();
    const parsed = parseForm(createUserSchema, body);
    if (!parsed.data) {
      return NextResponse.json(
        { ok: false, error: "Invalid user payload.", errors: parsed.errors },
        { status: 400 }
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const identity = await createIdentityUser(parsed.data.email, temporaryPassword);
    const profile = buildUserProfile({
      uid: identity.localId,
      email: identity.email,
      name: parsed.data.name,
      employeeId: parsed.data.employeeId,
      phone: parsed.data.phone || null,
      department: parsed.data.department || null,
      designation: parsed.data.designation || null,
      role: parsed.data.role,
      status: parsed.data.status,
    });

    await writeUserProfile(profile, identity.idToken);
    await writeAuditLog(identity.idToken, {
      actorId: session.uid,
      actorEmail: session.email,
      action: "users.create",
      module: "users",
      resource: "user",
      resourceId: profile.uid,
      description: `Provisioned ${profile.email} as ${profile.role}.`,
      severity: "notice",
      createdAt: new Date().toISOString(),
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      user: profile,
      temporaryPassword,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
