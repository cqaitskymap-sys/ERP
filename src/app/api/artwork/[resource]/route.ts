import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccess } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { ARTWORK_COLLECTIONS, isArtworkResource } from "@/lib/artwork/collections";
import { listArtworkRecords } from "@/lib/artwork/query";
import { createArtworkRequest } from "@/lib/artwork/server";

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await context.params;
    if (!isArtworkResource(resource)) throw createNamedError("ValidationError", "Unknown artwork resource.");
    const session = await requireSession();
    if (!canAccess(session, "artwork:read")) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listArtworkRecords(
      ARTWORK_COLLECTIONS[resource],
      {
        status: url.searchParams.get("status") || undefined,
        search: url.searchParams.get("search") || undefined,
        requestId: url.searchParams.get("requestId") || undefined,
        pageSize: Number(url.searchParams.get("pageSize") || 25),
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
    if (resource !== "requests") throw createNamedError("ValidationError", "Only artwork jobs can be created here.");
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown>;
    const idToken = requireIdToken(request);
    const result = await createArtworkRequest(body, session, idToken);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
