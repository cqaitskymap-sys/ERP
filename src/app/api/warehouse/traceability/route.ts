import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/server";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { loadBatchTraceability } from "@/lib/inventory/query";
import { createNamedError } from "@/lib/masters/errors";

export async function GET(request: Request) {
  try {
    await requirePermission("batchTraceability:read");
    const idToken = requireIdToken(request);
    const batchNumber = new URL(request.url).searchParams.get("batchNumber") || "";
    if (!batchNumber) throw createNamedError("ValidationError", "Batch number is required.");
    const result = await loadBatchTraceability(batchNumber, idToken);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
