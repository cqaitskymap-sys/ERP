import { DEFAULT_RISK_WEIGHTS, DEFAULT_SCORE_WEIGHTS, EXPIRY_THRESHOLDS } from "@/lib/supplier-quality/config";

export function calculateSupplierRisk(
  factors: Record<string, number>,
  weights = DEFAULT_RISK_WEIGHTS
) {
  const entries = Object.entries(weights).filter(([key]) => !["version", "method"].includes(key));
  const score = entries.reduce((sum, [key, weight]) => sum + Number(factors[key] || 0) * Number(weight), 0) / 10;
  return {
    riskScore: Math.round(score * 10) / 10,
    riskLevel: score >= 80 ? "critical" : score >= 60 ? "high" : score >= 35 ? "medium" : "low",
    method: weights.method,
    version: weights.version,
  };
}

export function calculateSupplierScore(
  dimensions: Record<string, number>,
  weights = DEFAULT_SCORE_WEIGHTS
) {
  const totalWeight = weights.quality + weights.delivery + weights.documentation + weights.compliance + weights.service;
  const overall =
    ((Number(dimensions.quality || 0) * weights.quality) +
      (Number(dimensions.delivery || 0) * weights.delivery) +
      (Number(dimensions.documentation || 0) * weights.documentation) +
      (Number(dimensions.compliance || 0) * weights.compliance) +
      (Number(dimensions.service || 0) * weights.service)) /
    (totalWeight || 1);
  return {
    overallScore: Math.round(overall * 10) / 10,
    method: weights.method,
    version: weights.version,
    weights,
  };
}

export function calculateExpiryStatus(expiryDate: unknown, now = new Date()) {
  const raw = String(expiryDate || "").trim();
  if (!raw) return { status: "valid", daysRemaining: null as number | null };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return { status: "valid", daysRemaining: null as number | null };
  const days = Math.ceil((date.getTime() - now.getTime()) / 86400000);
  if (days < 0) return { status: "expired", daysRemaining: days };
  if (days <= EXPIRY_THRESHOLDS[3]) return { status: "expiring_soon", daysRemaining: days };
  if (days <= EXPIRY_THRESHOLDS[0]) return { status: "expiring_soon", daysRemaining: days };
  return { status: "valid", daysRemaining: days };
}

export function calculateQualificationStatus(record: Record<string, unknown>, now = new Date()) {
  const expiry = calculateExpiryStatus(record.expiryDate || record.targetDate, now);
  if (String(record.status) === "approved" && expiry.status === "expired") return "expired";
  return String(record.status || "draft");
}

export function calculateRequalificationStatus(record: Record<string, unknown>, now = new Date()) {
  const due = calculateExpiryStatus(record.dueDate, now);
  if (!["approved", "rejected"].includes(String(record.status)) && due.status === "expired") return "overdue";
  return String(record.status || "not_started");
}

export function calculateSupplierPerformance(input: {
  receipts?: number;
  accepted?: number;
  rejected?: number;
  oos?: number;
  oot?: number;
  deviations?: number;
  capas?: number;
  complaints?: number;
}) {
  const receipts = Number(input.receipts || 0);
  const rejected = Number(input.rejected || 0);
  const rejectionRate = receipts > 0 ? Math.round((rejected / receipts) * 1000) / 10 : 0;
  return {
    receipts,
    accepted: Number(input.accepted || 0),
    rejected,
    rejectionRate,
    oos: Number(input.oos || 0),
    oot: Number(input.oot || 0),
    deviations: Number(input.deviations || 0),
    capas: Number(input.capas || 0),
    complaints: Number(input.complaints || 0),
  };
}

export function evaluateSupplierQualityGate(input: {
  profile?: Record<string, unknown> | null;
  materialQualification?: Record<string, unknown> | null;
  regulatedMaterial: boolean;
  allowConditional?: boolean;
  allowExpiredException?: boolean;
}) {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const profileStatus = String(input.profile?.status || "");
  if (profileStatus === "suspended") reasons.push("Supplier is suspended and cannot be used for controlled materials.");
  if (profileStatus === "disqualified") reasons.push("Supplier is disqualified and cannot be used.");
  if (profileStatus === "expired" && input.regulatedMaterial && !input.allowExpiredException) {
    reasons.push("Supplier qualification has expired.");
  } else if (profileStatus === "expired" && input.regulatedMaterial) {
    warnings.push("Expired qualification requires configured exception approval.");
  }
  const materialStatus = String(input.materialQualification?.qualificationStatus || "");
  if (input.regulatedMaterial && input.materialQualification) {
    if (materialStatus === "qualified") {
      // allowed
    } else if (materialStatus === "conditional") {
      warnings.push("Supplier is only conditionally qualified for this material.");
      if (input.allowConditional === false) reasons.push("Conditional supplier-material qualification requires additional approval.");
    } else if (["suspended", "disqualified", "expired"].includes(materialStatus)) {
      reasons.push(`Supplier-material qualification status "${materialStatus}" blocks procurement.`);
    } else if (materialStatus === "pending") {
      reasons.push("Supplier-material qualification is still pending.");
    }
  }
  return { allowed: reasons.length === 0, reasons, warnings };
}
