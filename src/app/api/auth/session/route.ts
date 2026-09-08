import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/auth/verify-id-token";
import { setSessionCookie } from "@/lib/auth/session";
import {
  readUserProfile,
  writeAuditLog,
  writeUserProfile,
} from "@/lib/auth/firestore-rest";
import { isAccountActive } from "@/lib/permissions/permission-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      idToken?: string;
      remember?: boolean;
    };

    if (!body.idToken) {
      return NextResponse.json(
        { ok: false, error: "A Firebase ID token is required." },
        { status: 400 }
      );
    }

    const identity = await verifyFirebaseIdToken(body.idToken);
    const profile = await readUserProfile(identity.uid, body.idToken);

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "This account has not been provisioned." },
        { status: 403 }
      );
    }

    if (!isAccountActive(profile.status)) {
      return NextResponse.json(
        { ok: false, error: "This account is not active." },
        { status: 403 }
      );
    }

    const nextProfile = {
      ...profile,
      lastLoginAt: new Date().toISOString(),
    };

    await writeUserProfile(nextProfile, body.idToken).catch(() => undefined);
    await setSessionCookie({
      uid: nextProfile.uid,
      email: nextProfile.email,
      employeeId: nextProfile.employeeId,
      name: nextProfile.name,
      role: nextProfile.role,
      roles: nextProfile.roles,
      permissions: nextProfile.permissions,
      status: nextProfile.status,
      remember: Boolean(body.remember),
    });

    await writeAuditLog(body.idToken, {
      actorId: nextProfile.uid,
      actorEmail: nextProfile.email,
      action: "auth.sign_in",
      module: "admin",
      resource: "session",
      description: "Secure session established.",
      severity: "info",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      user: {
        uid: nextProfile.uid,
        name: nextProfile.name,
        email: nextProfile.email,
        role: nextProfile.role,
        status: nextProfile.status,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Session creation failed.",
      },
      { status: 401 }
    );
  }
}
