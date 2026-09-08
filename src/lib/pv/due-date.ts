import { DEFAULT_PV_WINDOWS, ORGANIZATION_TIMEZONE } from "@/lib/pv/config";
import type { DueDateCalculation } from "@/types/pv";

function addUtcDays(dateValue: unknown, days: number) {
  const date = new Date(String(dateValue || new Date().toISOString()));
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setUTCDate(fallback.getUTCDate() + days);
    return fallback.toISOString();
  }
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

export function calculateCaseDueDate(
  receiptDate: unknown,
  rule?: { id?: string; processingWindow?: number; timezone?: string; version?: string }
): DueDateCalculation {
  const days = Number(rule?.processingWindow || DEFAULT_PV_WINDOWS.caseProcessingDays);
  return {
    ruleId: String(rule?.id || "default-case-window"),
    ruleVersion: String(rule?.version || "1"),
    calculatedAt: new Date().toISOString(),
    dueDate: addUtcDays(receiptDate, days),
    timezone: String(rule?.timezone || ORGANIZATION_TIMEZONE),
  };
}

export function calculateReportingDueDate(
  assessmentDate: unknown,
  rule?: { id?: string; reportingWindow?: number; timezone?: string; version?: string }
): DueDateCalculation {
  const days = Number(rule?.reportingWindow);
  if (!Number.isFinite(days) || days <= 0) {
    return {
      ruleId: String(rule?.id || ""),
      ruleVersion: String(rule?.version || "1"),
      calculatedAt: new Date().toISOString(),
      dueDate: "",
      timezone: String(rule?.timezone || ORGANIZATION_TIMEZONE),
    };
  }
  return {
    ruleId: String(rule?.id || "configured-reporting-window"),
    ruleVersion: String(rule?.version || "1"),
    calculatedAt: new Date().toISOString(),
    dueDate: addUtcDays(assessmentDate, days),
    timezone: String(rule?.timezone || ORGANIZATION_TIMEZONE),
  };
}

export function daysUntilUtc(dateValue: unknown, now = new Date()) {
  const raw = String(dateValue || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - now.getTime()) / 86400000);
}
