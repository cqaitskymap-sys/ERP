import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { confirmDmsUpload, prepareDmsUpload } from "@/lib/dms/dispatch";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string; intent?: string };
    const idToken = requireIdToken(request, body);
    const result =
      body.intent === "confirm" ? await confirmDmsUpload(body, session, idToken) : await prepareDmsUpload(body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
