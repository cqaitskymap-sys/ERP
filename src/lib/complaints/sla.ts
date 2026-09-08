import { DEFAULT_SLA } from "@/lib/complaints/config";

export type ComplaintSlaWindows = {
  id?: string;
  version?: string;
  timezone?: string;
  acknowledgementDays?: number;
  triageDays?: number;
  investigationDays?: number;
  qaReviewDays?: number;
  customerResponseDays?: number;
  closureDays?: number;
};

function addUtcDays(dateValue: unknown, days: number) {
  const date = new Date(String(dateValue || new Date().toISOString()));
  const base = Number.isNaN(date.getTime()) ? new Date() : date;
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

export function calculateComplaintDueDate(receivedDate: unknown, rule?: ComplaintSlaWindows) {
  const days = Number(rule?.closureDays || DEFAULT_SLA.closureDays);
  return {
    ruleId: String(rule?.id || "default-complaint-sla"),
    ruleVersion: String(rule?.version || "1"),
    calculatedAt: new Date().toISOString(),
    dueDate: addUtcDays(receivedDate, days),
    acknowledgementDueDate: addUtcDays(receivedDate, Number(rule?.acknowledgementDays || DEFAULT_SLA.acknowledgementDays)),
    triageDueDate: addUtcDays(receivedDate, Number(rule?.triageDays || DEFAULT_SLA.triageDays)),
    investigationDueDate: addUtcDays(receivedDate, Number(rule?.investigationDays || DEFAULT_SLA.investigationDays)),
    qaReviewDueDate: addUtcDays(receivedDate, Number(rule?.qaReviewDays || DEFAULT_SLA.qaReviewDays)),
    customerResponseDueDate: addUtcDays(receivedDate, Number(rule?.customerResponseDays || DEFAULT_SLA.customerResponseDays)),
    timezone: String(rule?.timezone || DEFAULT_SLA.timezone),
  };
}

export function calculateComplaintTAT(start: unknown, end?: unknown) {
  const from = new Date(String(start || ""));
  const to = new Date(String(end || new Date().toISOString()));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const hours = (to.getTime() - from.getTime()) / 36e5;
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.round(hours * 10) / 10;
}

export function summarizeTats(values: number[]) {
  if (!values.length) return { averageTatHours: 0, minTatHours: 0, maxTatHours: 0 };
  return {
    averageTatHours: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
    minTatHours: Math.round(Math.min(...values) * 10) / 10,
    maxTatHours: Math.round(Math.max(...values) * 10) / 10,
  };
}

export function daysUntilUtc(dateValue: unknown, now = new Date()) {
  const raw = String(dateValue || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - now.getTime()) / 86400000);
}
