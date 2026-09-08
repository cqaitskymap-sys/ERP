import { isUsableForNewTransactions } from "@/lib/masters/permissions";
import type { EligibilityResult } from "@/types/procurement";

const BLOCKED_VENDOR_STATUSES = new Set(["blocked", "suspended", "inactive", "rejected"]);
const QUALIFIED = new Set(["qualified", "conditionally_qualified"]);

export function checkVendorEligibility(input: {
  vendor?: Record<string, unknown> | null;
  mapping?: Record<string, unknown> | null;
  requireMaterialMapping?: boolean;
  regulatedMaterial?: boolean;
}): EligibilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!input.vendor) {
    return { eligible: false, reasons: ["Vendor was not found."], warnings };
  }
  const status = String(input.vendor.status || "");
  if (BLOCKED_VENDOR_STATUSES.has(status) || !isUsableForNewTransactions(status)) {
    reasons.push(`Vendor status "${status || "unknown"}" is not eligible for procurement.`);
  }
  if (status !== "active" && status !== "approved") {
    warnings.push("Vendor is not in Active status.");
  }
  const qualification = String(input.vendor.qualificationStatus || "");
  if (!QUALIFIED.has(qualification)) {
    reasons.push(`Vendor qualification "${qualification || "not started"}" is not valid for regulated procurement.`);
  }
  if (qualification === "conditionally_qualified") {
    warnings.push("Vendor is only conditionally qualified.");
  }
  if (input.requireMaterialMapping || input.regulatedMaterial) {
    if (!input.mapping) {
      reasons.push("No vendor-material mapping exists for this item.");
    } else {
      const mappingStatus = String(input.mapping.status || "");
      const role = String(input.mapping.supplierRole || "");
      if (mappingStatus !== "active") {
        reasons.push("Vendor-material mapping is not active.");
      }
      if (role === "blocked") {
        reasons.push("This vendor is blocked for the selected material.");
      }
      if (input.regulatedMaterial && !input.mapping.approvedSupplier && role !== "approved" && role !== "preferred") {
        reasons.push("Vendor is not an approved or preferred supplier for this material.");
      }
    }
  }
  const risk = String(input.vendor.riskCategory || "");
  if (risk === "high" || risk === "critical") {
    warnings.push(`Vendor risk category is ${risk}.`);
  }
  return { eligible: reasons.length === 0, reasons, warnings };
}

export function checkMaterialEligibility(input: {
  material?: Record<string, unknown> | null;
  requireSpecification?: boolean;
}): EligibilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!input.material) {
    return { eligible: false, reasons: ["Material was not found."], warnings };
  }
  const status = String(input.material.status || "");
  if (!isUsableForNewTransactions(status) || status === "draft") {
    reasons.push(`Material status "${status || "unknown"}" cannot be used for new procurement.`);
  }
  if (!String(input.material.uom || "").trim()) {
    reasons.push("Material has no UOM configured.");
  }
  if (input.requireSpecification && !String(input.material.specification || "").trim()) {
    warnings.push("No specification is recorded on the material master.");
  }
  return { eligible: reasons.length === 0, reasons, warnings };
}

export function isRegulatedMaterialType(materialType: unknown) {
  return ["api", "raw_material", "excipient", "packaging_material", "printed_packaging"].includes(
    String(materialType || "")
  );
}
