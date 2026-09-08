import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/server";
import { parseForm } from "@/lib/validation/schemas";
import { nextNumberSchema } from "@/lib/validation/masters";
import { masterErrorResponse, requireIdToken } from "@/lib/masters/http";
import { nextDocumentNumber } from "@/lib/masters/numbering";

export async function POST(request: Request) {
  try {
    const session = await requirePermission("masters:read");
    const body = (await request.json()) as {
      documentType?: string;
      financialYear?: string;
      idToken?: string;
    };
    const parsed = parseForm(nextNumberSchema, body);
    if (!parsed.data) {
      return NextResponse.json(
        { ok: false, error: Object.values(parsed.errors)[0] || "Document type is required." },
        { status: 400 }
      );
    }
    const result = await nextDocumentNumber({
      documentType: parsed.data.documentType,
      financialYear: parsed.data.financialYear,
      session,
      idToken: requireIdToken(request, body),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return masterErrorResponse(error);
  }
}
