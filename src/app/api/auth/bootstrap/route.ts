import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/auth/verify-id-token";
import { setSessionCookie } from "@/lib/auth/session";
import {
  createIdentityUser,
  signInIdentityUser,
} from "@/lib/auth/identity-toolkit";
import {
  readSystemConfig,
  writeSystemConfig,
  writeUserProfile,
  writeAuditLog,
} from "@/lib/auth/firestore-rest";
import { buildUserProfile } from "@/lib/auth/profile";
import { parseForm, setupSchema } from "@/lib/validation/schemas";

export async function GET() {
  const config = await readSystemConfig();
  return NextResponse.json({
    ok: true,
    bootstrapped: Boolean(config.bootstrapped),
  });
}

export async function POST(request: Request) {
  const config = await readSystemConfig();
  if (config.bootstrapped) {
    return NextResponse.json(
      { ok: false, error: "The workspace has already been initialized." },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }
  const parsed = parseForm(setupSchema, body);
  if (!parsed.data) {
    return NextResponse.json(
      { ok: false, error: "Invalid setup payload.", errors: parsed.errors },
      { status: 400 }
    );
  }

  try {
    let identity: { localId: string; idToken: string; email: string };
    try {
      identity = await createIdentityUser(parsed.data.email, parsed.data.password);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("EMAIL_EXISTS")) {
        identity = await signInIdentityUser(parsed.data.email, parsed.data.password);
      } else {
        throw error;
      }
    }

    await verifyFirebaseIdToken(identity.idToken);

    const profile = buildUserProfile({
      uid: identity.localId,
      email: identity.email,
      name: parsed.data.name,
      employeeId: parsed.data.employeeId,
      phone: parsed.data.phone || null,
      department: parsed.data.department || "Administration",
      designation: parsed.data.designation || "Super Admin",
      role: "super_admin",
      status: "active",
    });
    profile.lastLoginAt = new Date().toISOString();

    await writeUserProfile(profile, identity.idToken);
    await writeSystemConfig(identity.idToken);
    await setSessionCookie({
      uid: profile.uid,
      email: profile.email,
      employeeId: profile.employeeId,
      name: profile.name,
      role: profile.role,
      roles: profile.roles,
      permissions: profile.permissions,
      status: profile.status,
      remember: true,
    });
    await writeAuditLog(identity.idToken, {
      actorId: profile.uid,
      actorEmail: profile.email,
      action: "auth.bootstrap",
      module: "admin",
      resource: "system",
      description: "Initial Super Admin workspace created.",
      severity: "notice",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      user: {
        uid: profile.uid,
        email: profile.email,
        name: profile.name,
        role: profile.role,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Workspace setup failed.",
      },
      { status: 400 }
    );
  }
}
