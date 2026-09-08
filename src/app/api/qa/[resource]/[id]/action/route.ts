import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { runQaAction } from "@/lib/qa/dispatch";
import { isQaResource } from "@/lib/qa/http";

export async function POST(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  try {
    const { resource, id } = await context.params;
    if (!isQaResource(resource)) throw createNamedError("ValidationError", "Unknown QA resource.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { action?: string; idToken?: string };
    const idToken = requireIdToken(request, body);
    const action = String(body.action || "");
    if (!action) throw createNamedError("ValidationError", "Action is required.");
    const result = await runQaAction(resource, id, action, body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
