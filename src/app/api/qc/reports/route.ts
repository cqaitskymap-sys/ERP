import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadQcReport } from "@/lib/qc/query";
import { QC_REPORT_TYPES } from "@/types/qc";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["qc:read", "quality:read", "qcCoa:export", "qcTest:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "";
    if (!QC_REPORT_TYPES.includes(type as (typeof QC_REPORT_TYPES)[number])) {
      throw createNamedError("ValidationError", "Unknown QC report.");
    }
    const result = await loadQcReport(
      type as (typeof QC_REPORT_TYPES)[number],
      {
        status: url.searchParams.get("status") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        materialId: url.searchParams.get("materialId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        vendorId: url.searchParams.get("vendorId") || undefined,
        batchNumber: url.searchParams.get("batchNumber") || undefined,
        analystId: url.searchParams.get("analystId") || undefined,
        pageSize: Number(url.searchParams.get("pageSize") || 50),
      },
      idToken
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
