import { NextResponse } from "next/server";
import { authErrorResponse, requirePermission } from "@/lib/auth/server";
import { verifyFirebaseIdToken } from "@/lib/auth/verify-id-token";
import {
  readUserProfile,
  writeAuditLog,
  writeUserProfile,
} from "@/lib/auth/firestore-rest";
import { accountStatusSchema, parseForm } from "@/lib/validation/schemas";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission("users:update");
    const { id } = await context.params;
    const body = (await request.json()) as {
      status?: string;
      idToken?: string;
    };
    const parsed = parseForm(accountStatusSchema, { status: body.status });

    if (!parsed.data || !body.idToken) {
      return NextResponse.json(
        { ok: false, error: "Status and a Firebase ID token are required." },
        { status: 400 }
      );
    }

    if (session.uid === id && parsed.data.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "You cannot deactivate your own session." },
        { status: 400 }
      );
    }

    const identity = await verifyFirebaseIdToken(body.idToken);
    if (identity.uid !== session.uid) {
      return NextResponse.json(
        { ok: false, error: "The supplied token does not match the session." },
        { status: 401 }
      );
    }

    const target = await readUserProfile(id, body.idToken);
    if (!target) {
      return NextResponse.json(
        { ok: false, error: "User profile was not found." },
        { status: 404 }
      );
    }

    const next = { ...target, status: parsed.data.status };
    await writeUserProfile(next, body.idToken);
    await writeAuditLog(body.idToken, {
      actorId: session.uid,
      actorEmail: session.email,
      action: `users.${parsed.data.status === "active" ? "activate" : "deactivate"}`,
      module: "users",
      resource: "user",
      resourceId: id,
      description: `Changed account status to ${parsed.data.status}.`,
      severity: "warning",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, user: next });
  } catch (error) {
    return authErrorResponse(error);
  }
}
