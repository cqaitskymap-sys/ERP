import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { createComplaintRecord } from "@/lib/complaints/dispatch";
import { COMPLAINT_RESOURCES, isComplaintResource, READ_ALIASES } from "@/lib/complaints/http";
import { listComplaintRecords } from "@/lib/complaints/query";

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isComplaintResource(resource)) throw createNamedError("ValidationError", "Unknown complaint resource.");
    const session = await requireSession();
    if (!canAccessAny(session, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listComplaintRecords(
      COMPLAINT_RESOURCES[resource].collection,
      {
        status: url.searchParams.get("status") || undefined,
        severity: url.searchParams.get("severity") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        batchNumber: url.searchParams.get("batchNumber") || undefined,
        marketId: url.searchParams.get("marketId") || undefined,
        assignedTo: url.searchParams.get("assignedTo") || undefined,
        category: url.searchParams.get("category") || undefined,
        complaintId: url.searchParams.get("complaintId") || undefined,
        investigationId: url.searchParams.get("investigationId") || undefined,
        recallId: url.searchParams.get("recallId") || undefined,
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
    if (!isComplaintResource(resource)) throw createNamedError("ValidationError", "Unknown complaint resource.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    const result = await createComplaintRecord(resource, body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
