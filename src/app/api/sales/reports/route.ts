import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/server";
import { canAccessAny, hasPermission } from "@/lib/permissions/permission-service";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { createNamedError } from "@/lib/masters/errors";
import { loadSalesReport } from "@/lib/sales/query";
import { SALES_REPORT_TYPES, type SalesReportType } from "@/types/sales";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessAny(session, ["salesReports:read", "sales:read", "salesOrder:read"])) {
      throw createNamedError("ForbiddenError", "You do not have permission for this action.");
    }
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const type = String(url.searchParams.get("type") || "sales_order_register") as SalesReportType;
    if (!SALES_REPORT_TYPES.includes(type)) {
      throw createNamedError("ValidationError", "Unknown sales report type.");
    }
    if (
      (type === "customer_balances" || type === "customer_sales") &&
      !hasPermission(session.permissions, "salesCredit:read") &&
      !hasPermission(session.permissions, "finance:read") &&
      !hasPermission(session.permissions, "salesOrder:export")
    ) {
      // Still allow report structure, but query layer strips pricing for unauthorized users.
    }
    const result = await loadSalesReport(
      type,
      {
        customerId: url.searchParams.get("customerId") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        salesRepresentative: url.searchParams.get("salesRepresentative") || undefined,
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
        status: url.searchParams.get("status") || undefined,
      },
      idToken,
      session
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
