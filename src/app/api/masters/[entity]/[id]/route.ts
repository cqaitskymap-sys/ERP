import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/server";
import { readMasterDocument } from "@/lib/masters/firestore";
import { getMasterDefinition } from "@/lib/masters/registry";
import { masterErrorResponse, requireIdToken, requireMasterEntity } from "@/lib/masters/http";
import { masterPermission } from "@/lib/masters/permissions";
import { saveMaster } from "@/lib/masters/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ entity: string; id: string }> }
) {
  try {
    const { entity, id } = await context.params;
    const master = requireMasterEntity(entity);
    await requirePermission(masterPermission(master, "read"));
    const definition = getMasterDefinition(master)!;
    const idToken = requireIdToken(request);
    const record = await readMasterDocument(definition.collection, id, idToken);
    if (!record) {
      return NextResponse.json({ ok: false, error: "Record not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return masterErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ entity: string; id: string }> }
) {
  try {
    const { entity, id } = await context.params;
    const master = requireMasterEntity(entity);
    const session = await requirePermission(masterPermission(master, "update"));
    const body = (await request.json()) as Record<string, unknown> & {
      idToken?: string;
      reason?: string;
    };
    const idToken = requireIdToken(request, body);
    const record = await saveMaster({
      entity: master,
      payload: body,
      session,
      idToken,
      id,
      reason: body.reason,
    });
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
