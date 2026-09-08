import { NextResponse } from "next/server";
import { clearSessionCookie, readSessionCookie } from "@/lib/auth/session";

export async function POST() {
  const session = await readSessionCookie();
  await clearSessionCookie();
  return NextResponse.json({
    ok: true,
    signedOut: Boolean(session),
  });
}
