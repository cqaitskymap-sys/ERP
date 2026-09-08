import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { actOnProcessStep } from "@/lib/production/server";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { action?: string; stepId?: string; idToken?: string };
    const idToken = requireIdToken(request, body);
    const stepId = String(body.stepId || "");
    const action = String(body.action || "");
    if (!stepId || !action) throw createNamedError("ValidationError", "Step and action are required.");
    if (!["start", "complete", "skip", "fail"].includes(action)) {
      throw createNamedError("ValidationError", "Unknown process-step action.");
    }
    const result = await actOnProcessStep({
      id: stepId,
      action: action as "start" | "complete" | "skip" | "fail",
      remarks: String(body.remarks || body.comment || ""),
      session,
      idToken,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
