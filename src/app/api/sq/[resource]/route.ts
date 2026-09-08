import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { hasAnyPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { createSqRecord } from "@/lib/supplier-quality/dispatch";
import { isSqResource, READ_ALIASES, SQ_RESOURCES } from "@/lib/supplier-quality/http";
import { listSqRecords } from "@/lib/supplier-quality/query";

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isSqResource(resource)) throw createNamedError("ValidationError", "Unknown supplier-quality resource.");
    const session = await requireSession();
    if (!hasAnyPermission(session.permissions, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listSqRecords(
      SQ_RESOURCES[resource].collection,
      {
        status: url.searchParams.get("status") || undefined,
        riskLevel: url.searchParams.get("riskLevel") || undefined,
        supplierId: url.searchParams.get("supplierId") || undefined,
        materialId: url.searchParams.get("materialId") || undefined,
        qualificationId: url.searchParams.get("qualificationId") || undefined,
        auditId: url.searchParams.get("auditId") || undefined,
        search: url.searchParams.get("search") || undefined,
        pageSize: Number(url.searchParams.get("pageSize") || 20),
        cursor: url.searchParams.get("cursor") || undefined,
      },
      idToken
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isSqResource(resource)) throw createNamedError("ValidationError", "Unknown supplier-quality resource.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    const result = await createSqRecord(resource, body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
