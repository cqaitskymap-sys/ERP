import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { createQcRecord } from "@/lib/qc/dispatch";
import { isQcResource, QC_RESOURCES, READ_ALIASES } from "@/lib/qc/http";
import { listQcRecords } from "@/lib/qc/query";

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isQcResource(resource)) throw createNamedError("ValidationError", "Unknown QC resource.");
    const session = await requireSession();
    if (!canAccessAny(session, READ_ALIASES[resource])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listQcRecords(
      QC_RESOURCES[resource].collection,
      {
        status: url.searchParams.get("status") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        materialId: url.searchParams.get("materialId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        vendorId: url.searchParams.get("vendorId") || undefined,
        batchNumber: url.searchParams.get("batchNumber") || undefined,
        sampleId: url.searchParams.get("sampleId") || undefined,
        analystId: url.searchParams.get("analystId") || undefined,
        testRequestId: url.searchParams.get("testRequestId") || undefined,
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
    if (!isQcResource(resource)) throw createNamedError("ValidationError", "Unknown QC resource.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    const result = await createQcRecord(resource, body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
