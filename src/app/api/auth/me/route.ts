import { NextResponse } from "next/server";
import { authErrorResponse, requireSession, toPublicProfile } from "@/lib/auth/server";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json({
      ok: true,
      user: toPublicProfile(session),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
