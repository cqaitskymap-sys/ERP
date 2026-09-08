import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { saveInventoryDocument } from "@/lib/inventory/server";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    const result = await saveInventoryDocument({ payload: body, session, idToken });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
