import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/server";
import { masterErrorResponse, requireIdToken, requireMasterEntity } from "@/lib/masters/http";
import { masterPermission } from "@/lib/masters/permissions";
import { listMasters, saveMaster } from "@/lib/masters/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await context.params;
    const master = requireMasterEntity(entity);
    await requirePermission(masterPermission(master, "read"));
    const idToken = requireIdToken(request);
    const url = new URL(request.url);
    const result = await listMasters(
      master,
      {
        status: url.searchParams.get("status") || "all",
        companyId: url.searchParams.get("companyId") || undefined,
        plantId: url.searchParams.get("plantId") || undefined,
        warehouseId: url.searchParams.get("warehouseId") || undefined,
        departmentId: url.searchParams.get("departmentId") || undefined,
        productId: url.searchParams.get("productId") || undefined,
        materialId: url.searchParams.get("materialId") || undefined,
        customerId: url.searchParams.get("customerId") || undefined,
        supplierId: url.searchParams.get("supplierId") || undefined,
        formulaId: url.searchParams.get("formulaId") || undefined,
        productType: url.searchParams.get("productType") || undefined,
        materialType: url.searchParams.get("materialType") || undefined,
        dosageForm: url.searchParams.get("dosageForm") || undefined,
        uom: url.searchParams.get("uom") || undefined,
        vendorId: url.searchParams.get("vendorId") || undefined,
        customerType: url.searchParams.get("customerType") || undefined,
        vendorType: url.searchParams.get("vendorType") || undefined,
        qualificationStatus: url.searchParams.get("qualificationStatus") || undefined,
        riskCategory: url.searchParams.get("riskCategory") || undefined,
        country: url.searchParams.get("country") || undefined,
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

export async function POST(
  request: Request,
  context: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await context.params;
    const master = requireMasterEntity(entity);
    const session = await requirePermission(masterPermission(master, "create"));
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
      reason: body.reason,
    });
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
