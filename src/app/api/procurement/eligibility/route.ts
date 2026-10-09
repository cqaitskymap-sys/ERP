import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { evaluateMaterialEligibility, evaluateVendorEligibility } from "@/lib/procurement/lookups";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["rfq:create", "purchaseOrder:create", "quotation:create", "purchaseRequisition:create"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const body = (await request.json()) as Record<string, string> & { idToken?: string };
    const idToken = requireIdToken(request, body);
    if (body.kind === "material") {
      if (!body.materialId) throw createNamedError("ValidationError", "Material is required.");
      const result = await evaluateMaterialEligibility({ materialId: body.materialId, idToken, requireSpecification: true });
      return NextResponse.json({ ok: true, result: { eligible: result.eligible, reasons: result.reasons, warnings: result.warnings } });
    }
    if (!body.vendorId) throw createNamedError("ValidationError", "Vendor is required.");
    const result = await evaluateVendorEligibility({
      vendorId: body.vendorId,
      materialId: body.materialId,
      idToken,
    });
    return NextResponse.json({
      ok: true,
      result: { eligible: result.eligible, reasons: result.reasons, warnings: result.warnings },
    });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
