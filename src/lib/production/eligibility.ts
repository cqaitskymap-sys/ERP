import { isUsableForNewTransactions } from "@/lib/masters/permissions";
import type { EligibilityResult } from "@/types/production";

const MANUFACTURING_PRODUCT_TYPES = new Set(["finished", "semi_finished", "bulk", "intermediate"]);
const BLOCKED_EQUIPMENT = new Set(["inactive", "under_maintenance", "unqualified", "calibration_expired"]);

export function checkProductEligibility(input: {
  product?: Record<string, unknown> | null;
  version?: Record<string, unknown> | null;
  requireVersion?: boolean;
}): EligibilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!input.product) return { eligible: false, reasons: ["Product was not found."], warnings };
  const status = String(input.product.status || "");
  if (status !== "active" || !isUsableForNewTransactions(status)) {
    reasons.push(`Product status "${status || "unknown"}" cannot be manufactured.`);
  }
  const type = String(input.product.productType || "");
  if (type && !MANUFACTURING_PRODUCT_TYPES.has(type) && type !== "trial") {
    warnings.push(`Product type "${type}" is unusual for routine manufacturing.`);
  }
  if (type === "trial") warnings.push("Trial products require extra controls.");
  if (input.requireVersion) {
    if (!input.version) reasons.push("A valid product version is required.");
    else if (!["approved", "active", "effective"].includes(String(input.version.status || ""))) {
      reasons.push("The selected product version is not approved for manufacturing.");
    }
  }
  return { eligible: reasons.length === 0, reasons, warnings };
}

export function checkCustomerEligibility(input: {
  customer?: Record<string, unknown> | null;
  mapping?: Record<string, unknown> | null;
  requireMapping?: boolean;
}): EligibilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!input.customer) return { eligible: false, reasons: ["Customer was not found."], warnings };
  const status = String(input.customer.status || "");
  if (!isUsableForNewTransactions(status) || status === "blocked") {
    reasons.push(`Customer status "${status || "unknown"}" is not eligible.`);
  }
  if (input.requireMapping && !input.mapping) {
    reasons.push("No customer-product mapping exists for this third-party product.");
  } else if (input.mapping && !isUsableForNewTransactions(input.mapping.status)) {
    reasons.push("The customer-product mapping is not active.");
  }
  return { eligible: reasons.length === 0, reasons, warnings };
}

export function checkEquipmentEligibility(input: {
  equipment?: Record<string, unknown> | null;
}): EligibilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!input.equipment) return { eligible: false, reasons: ["Equipment was not found."], warnings };
  const status = String(input.equipment.status || "");
  const qualification = String(input.equipment.qualificationStatus || "");
  const calibration = String(input.equipment.calibrationStatus || "");
  if (BLOCKED_EQUIPMENT.has(status) || !isUsableForNewTransactions(status)) {
    reasons.push(`Equipment status "${status || "unknown"}" cannot be used.`);
  }
  if (qualification && !["qualified", "approved"].includes(qualification)) {
    reasons.push(`Equipment qualification "${qualification}" is not valid.`);
  }
  if (calibration === "expired" || calibration === "overdue") {
    reasons.push("Equipment calibration is expired.");
  }
  if (!qualification) warnings.push("Equipment qualification is not recorded.");
  if (!calibration) warnings.push("Equipment calibration status is not recorded.");
  return { eligible: reasons.length === 0, reasons, warnings };
}

export function checkOperatorEligibility(input: {
  user?: Record<string, unknown> | null;
  requireTraining?: boolean;
}): EligibilityResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!input.user) return { eligible: false, reasons: ["Operator was not found."], warnings };
  if (String(input.user.status || "") !== "active") {
    reasons.push("Only active users can be assigned as operators.");
  }
  const training = String(input.user.trainingStatus || "");
  if (input.requireTraining && training && !["qualified", "trained", "current"].includes(training)) {
    reasons.push(`Operator training status "${training}" is not sufficient.`);
  }
  if (!training) {
    warnings.push("Training eligibility is not recorded. Future LMS integration will enforce this.");
  }
  return { eligible: reasons.length === 0, reasons, warnings };
}
