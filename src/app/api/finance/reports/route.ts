import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadFinanceReport } from "@/lib/finance/query";
import { FINANCE_REPORT_TYPES, type FinanceReportType } from "@/types/finance";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["financeReports:read", "finance:read", "financeReports:export"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const type = String(url.searchParams.get("type") || "trial_balance") as FinanceReportType;
    if (!FINANCE_REPORT_TYPES.includes(type)) {
      throw createNamedError("ValidationError", "Unknown finance report type.");
    }
    const result = await loadFinanceReport(
      type,
      {
        supplierId: url.searchParams.get("supplierId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        costCenterId: url.searchParams.get("costCenterId") || undefined,
        periodId: url.searchParams.get("periodId") || undefined,
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
      },
      idToken,
      session
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
