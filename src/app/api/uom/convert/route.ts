import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/server";
import { convertQuantity } from "@/lib/masters/convert";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";

export async function POST(request: Request) {
  try {
    await requirePermission("masters:read");
    const body = (await request.json()) as {
      fromUomId?: string;
      toUomId?: string;
      quantity?: number;
      idToken?: string;
    };
    if (!body.fromUomId || !body.toUomId || typeof body.quantity !== "number") {
      return NextResponse.json(
        { ok: false, error: "From UOM, To UOM, and quantity are required." },
        { status: 400 }
      );
    }
    const quantity = await convertQuantity({
      fromUomId: body.fromUomId,
      toUomId: body.toUomId,
      quantity: body.quantity,
      idToken: requireIdToken(request, body),
    });
    return NextResponse.json({ ok: true, quantity });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
