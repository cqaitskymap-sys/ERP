import { queryMasterDocuments, readMasterDocument } from "@/lib/masters/firestore";
import {
  checkMaterialEligibility,
  checkVendorEligibility,
  isRegulatedMaterialType,
} from "@/lib/procurement/eligibility";
import { fail, text } from "@/lib/procurement/helpers";
import type { EligibilityResult } from "@/types/procurement";

export async function evaluateVendorEligibility(options: {
  vendorId: string;
  materialId?: string;
  idToken: string;
  requireMaterialMapping?: boolean;
}): Promise<EligibilityResult & { vendor: Record<string, unknown> | null; mapping: Record<string, unknown> | null }> {
  const vendor = await readMasterDocument("vendors", options.vendorId, options.idToken);
  let mapping: Record<string, unknown> | null = null;
  let regulated = false;
  if (options.materialId) {
    const material = await readMasterDocument("materials", options.materialId, options.idToken);
    regulated = isRegulatedMaterialType(material?.materialType);
    const maps = await queryMasterDocuments("vendorMaterials", options.idToken, {
      filters: [
        { field: "vendorId", value: options.vendorId },
        { field: "materialId", value: options.materialId },
      ],
      limit: 5,
    });
    mapping = maps[0] || null;
  }
  const result = checkVendorEligibility({
    vendor,
    mapping,
    requireMaterialMapping: options.requireMaterialMapping,
    regulatedMaterial: regulated,
  });
  return { ...result, vendor, mapping };
}

export async function evaluateMaterialEligibility(options: {
  materialId: string;
  idToken: string;
  requireSpecification?: boolean;
}) {
  const material = await readMasterDocument("materials", options.materialId, options.idToken);
  return {
    ...checkMaterialEligibility({
      material,
      requireSpecification: options.requireSpecification,
    }),
    material,
  };
}

export async function requireEligibleVendor(options: {
  vendorId: string;
  materialIds: string[];
  idToken: string;
}) {
  if (!options.materialIds.length) {
    const check = await evaluateVendorEligibility({ vendorId: options.vendorId, idToken: options.idToken });
    if (!check.eligible) fail(check.reasons[0] || "Vendor is not eligible.");
    return check;
  }
  let last = await evaluateVendorEligibility({ vendorId: options.vendorId, idToken: options.idToken });
  for (const materialId of options.materialIds) {
    last = await evaluateVendorEligibility({
      vendorId: options.vendorId,
      materialId,
      idToken: options.idToken,
    });
    if (!last.eligible) fail(last.reasons[0] || "Vendor is not eligible for one or more materials.");
  }
  const { assertSupplierQualityForProcurement } = await import("@/lib/supplier-quality/server");
  await assertSupplierQualityForProcurement({
    vendorId: options.vendorId,
    materialIds: options.materialIds,
    idToken: options.idToken,
  });
  return last;
}

export async function requireEligibleMaterial(materialId: string, idToken: string) {
  const check = await evaluateMaterialEligibility({ materialId, idToken, requireSpecification: true });
  if (!check.eligible) fail(check.reasons[0] || "Material is not eligible for procurement.");
  return check;
}

export function materialLabel(material: Record<string, unknown> | null | undefined) {
  return text(material?.materialName || material?.name || material?.materialCode || "");
}
