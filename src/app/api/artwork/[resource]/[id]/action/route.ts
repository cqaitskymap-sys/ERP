import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { actOnArtwork } from "@/lib/artwork/server";

export async function POST(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const { resource, id } = await context.params;
    if (resource !== "requests") throw createNamedError("ValidationError", "Actions apply to artwork jobs.");
    const session = await requireSession();
    const body = (await request.json()) as { action?: string; comment?: string };
    const idToken = requireIdToken(request);
    const result = await actOnArtwork(id, String(body.action || ""), String(body.comment || ""), session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
